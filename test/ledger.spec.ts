// Non-regression tests for the Ledger fork customizations.
// These must keep passing when the fork is rebased on a new upstream version.
import * as assert from 'assert';
import { describe, it } from 'mocha';
import * as bitcoin from 'bitcoinjs-lib';
import { Transaction } from 'bitcoinjs-lib';
import * as tools from 'uint8array-tools';
import * as ecc from 'tiny-secp256k1';

const BIG_VALUE = 43801840396708984n; // > Number.MAX_SAFE_INTEGER

const filled = (length: number, byte: number): Uint8Array =>
  new Uint8Array(length).fill(byte);

const P2WPKH_SCRIPT = tools.fromHex('0014' + '33'.repeat(20));
const P2PKH_SCRIPT = tools.fromHex('76a914' + '44'.repeat(20) + '88ac');
const P2TR_SCRIPT = tools.fromHex('5120' + '77'.repeat(32));

const WITNESS_0 = [filled(71, 0x55), filled(33, 0x02)];
const WITNESS_1 = [filled(72, 0x66), filled(33, 0x03)];

const INS_HEX =
  '02' +
  '11'.repeat(32) +
  '00000000' +
  '00' +
  'fdffffff' +
  '22'.repeat(32) +
  '01000000' +
  '00' +
  'ffffffff';
const OUTS_HEX =
  '02' +
  '3930000000000000' +
  '16' +
  tools.toHex(P2WPKH_SCRIPT) +
  '78ac5ab18a9d9b00' +
  '19' +
  tools.toHex(P2PKH_SCRIPT);
const WITNESSES_HEX =
  '02' +
  '47' +
  '55'.repeat(71) +
  '21' +
  '02'.repeat(33) +
  '02' +
  '48' +
  '66'.repeat(72) +
  '21' +
  '03'.repeat(33);
const LOCKTIME_HEX = 'c0270900';

const VECTORS = {
  // native segwit, unsigned: marker & flag but no witness section (HSM format)
  nativeSegwitUnsigned: '02000000' + '0001' + INS_HEX + OUTS_HEX + LOCKTIME_HEX,
  // native segwit, signed: standard segwit serialization
  nativeSegwitSigned:
    '02000000' + '0001' + INS_HEX + OUTS_HEX + WITNESSES_HEX + LOCKTIME_HEX,
  // legacy: no marker & flag
  legacy: '02000000' + INS_HEX + OUTS_HEX + LOCKTIME_HEX,
};

function buildTx(nativeSegwit: boolean, withWitnesses: boolean): Transaction {
  const tx = new Transaction();
  tx.version = 2;
  tx.locktime = 600000;
  tx.addInput(filled(32, 0x11), 0, 0xfffffffd);
  tx.addInput(filled(32, 0x22), 1);
  tx.addOutput(P2WPKH_SCRIPT, 12345n);
  tx.addOutput(P2PKH_SCRIPT, BIG_VALUE);
  tx.setNativeSegwit(nativeSegwit);
  if (withWitnesses) {
    tx.setWitness(0, WITNESS_0);
    tx.setWitness(1, WITNESS_1);
  }
  return tx;
}

function assertParsedTx(tx: Transaction, withWitnesses: boolean): void {
  assert.strictEqual(tx.version, 2);
  assert.strictEqual(tx.locktime, 600000);
  assert.strictEqual(tx.ins.length, 2);
  assert.deepStrictEqual(tx.ins[0].hash, filled(32, 0x11));
  assert.strictEqual(tx.ins[0].index, 0);
  assert.strictEqual(tx.ins[0].sequence, 0xfffffffd);
  assert.deepStrictEqual(tx.ins[1].hash, filled(32, 0x22));
  assert.strictEqual(tx.ins[1].index, 1);
  assert.strictEqual(tx.ins[1].sequence, 0xffffffff);
  assert.strictEqual(tx.outs.length, 2);
  assert.strictEqual(tx.outs[0].value, 12345n);
  assert.deepStrictEqual(tx.outs[0].script, P2WPKH_SCRIPT);
  assert.strictEqual(tx.outs[1].value, BIG_VALUE);
  assert.deepStrictEqual(tx.outs[1].script, P2PKH_SCRIPT);
  if (withWitnesses) {
    assert.deepStrictEqual(tx.ins[0].witness, WITNESS_0);
    assert.deepStrictEqual(tx.ins[1].witness, WITNESS_1);
  } else {
    assert.deepStrictEqual(tx.ins[0].witness, []);
    assert.deepStrictEqual(tx.ins[1].witness, []);
  }
}

describe('Ledger fork customizations', () => {
  describe('exports', () => {
    it('exports the bufferutils and transaction modules', () => {
      assert.strictEqual(typeof bitcoin.bufferutils.BufferReader, 'function');
      assert.strictEqual(typeof bitcoin.bufferutils.BufferWriter, 'function');
      assert.strictEqual(typeof bitcoin.bufferutils.reverseBuffer, 'function');
      assert.strictEqual(bitcoin.transaction.Transaction, Transaction);
      assert.strictEqual(
        bitcoin.transaction.varSliceSize(new Uint8Array(10)),
        11,
      );
      assert.strictEqual(
        bitcoin.transaction.varSliceSize(new Uint8Array(253)),
        256,
      );
    });

    it('exports the psbtutils script type detectors', () => {
      assert.strictEqual(bitcoin.isP2WPKH(P2WPKH_SCRIPT), true);
      assert.strictEqual(bitcoin.isP2WPKH(P2PKH_SCRIPT), false);
      assert.strictEqual(bitcoin.isP2PKH(P2PKH_SCRIPT), true);
      bitcoin.initEccLib(ecc);
      const G_X =
        '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
      assert.strictEqual(bitcoin.isP2TR(tools.fromHex('5120' + G_X)), true);
      assert.strictEqual(
        bitcoin.isP2SHScript(tools.fromHex('a914' + '55'.repeat(20) + '87')),
        true,
      );
      assert.strictEqual(
        bitcoin.isP2WSHScript(tools.fromHex('0020' + '66'.repeat(32))),
        true,
      );
      assert.strictEqual(
        bitcoin.isP2PK(tools.fromHex('21' + '02'.repeat(33) + 'ac')),
        true,
      );
      assert.strictEqual(
        bitcoin.isP2MS(
          tools.fromHex(
            '5121' + '02'.repeat(33) + '21' + '03'.repeat(33) + '52ae',
          ),
        ),
        true,
      );
    });
  });

  describe('nativeSegwit', () => {
    it('defaults to false', () => {
      const tx = new Transaction();
      assert.strictEqual(tx.nativeSegwit, false);
      assert.strictEqual(tx.isNativeSegwit(), false);
    });

    it('can be set and read back', () => {
      const tx = new Transaction();
      tx.setNativeSegwit(true);
      assert.strictEqual(tx.isNativeSegwit(), true);
      tx.setNativeSegwit(false);
      assert.strictEqual(tx.isNativeSegwit(), false);
    });
  });

  describe('serialization', () => {
    it('writes marker & flag without witnesses when native segwit', () => {
      const tx = buildTx(true, false);
      assert.strictEqual(tx.toHex(), VECTORS.nativeSegwitUnsigned);
      assert.strictEqual(tx.byteLength(), tx.toBuffer().length);
      assert.strictEqual(tx.byteLength(), 159);
    });

    it('writes marker, flag and witnesses when native segwit and signed', () => {
      const tx = buildTx(true, true);
      assert.strictEqual(tx.toHex(), VECTORS.nativeSegwitSigned);
      assert.strictEqual(tx.byteLength(), tx.toBuffer().length);
      assert.strictEqual(tx.byteLength(), 374);
    });

    it('writes no marker & flag when not native segwit', () => {
      const tx = buildTx(false, false);
      assert.strictEqual(tx.toHex(), VECTORS.legacy);
      assert.strictEqual(tx.byteLength(), tx.toBuffer().length);
      assert.strictEqual(tx.byteLength(), 157);
    });
  });

  describe('standard segwit behavior is preserved', () => {
    it('computes the txid without marker & flag', () => {
      const legacyId =
        '9b644e17ca5d8e4d0687c8441d2ad16787287b037184d126c0b44709f6f24b0a';
      assert.strictEqual(buildTx(false, false).getId(), legacyId);
      assert.strictEqual(buildTx(true, false).getId(), legacyId);
      assert.strictEqual(buildTx(true, true).getId(), legacyId);
    });

    it('computes weight without marker & flag in the base size', () => {
      assert.strictEqual(buildTx(false, false).weight(), 157 * 4);
      assert.strictEqual(buildTx(true, false).weight(), 157 * 3 + 159);
      assert.strictEqual(buildTx(true, true).weight(), 157 * 3 + 374);
    });

    it('round-trips a witness transaction parsed with fromHex', () => {
      const tx = Transaction.fromHex(VECTORS.nativeSegwitSigned);
      assert.strictEqual(tx.isNativeSegwit(), false);
      assertParsedTx(tx, true);
      assert.strictEqual(tx.toHex(), VECTORS.nativeSegwitSigned);
      assert.strictEqual(tx.byteLength(), 374);
    });
  });

  describe('fromLedgerVaultHex / fromLedgerVaultBuffer', () => {
    it('parses an unsigned native segwit transaction', () => {
      const tx = Transaction.fromLedgerVaultHex(
        VECTORS.nativeSegwitUnsigned,
        false,
        true,
      );
      assertParsedTx(tx, false);
      assert.strictEqual(tx.isNativeSegwit(), true);
      assert.strictEqual(tx.toHex(), VECTORS.nativeSegwitUnsigned);
    });

    it('parses a signed native segwit transaction', () => {
      const tx = Transaction.fromLedgerVaultHex(
        VECTORS.nativeSegwitSigned,
        true,
        true,
      );
      assertParsedTx(tx, true);
      assert.strictEqual(tx.isNativeSegwit(), true);
      assert.strictEqual(tx.toHex(), VECTORS.nativeSegwitSigned);
    });

    it('parses a legacy transaction', () => {
      for (const isSigned of [false, true]) {
        const tx = Transaction.fromLedgerVaultHex(
          VECTORS.legacy,
          isSigned,
          false,
        );
        assertParsedTx(tx, false);
        assert.strictEqual(tx.isNativeSegwit(), false);
        assert.strictEqual(tx.toHex(), VECTORS.legacy);
      }
    });

    it('parses a signed native segwit transaction by default', () => {
      const tx = Transaction.fromLedgerVaultBuffer(
        tools.fromHex(VECTORS.nativeSegwitSigned),
      );
      assertParsedTx(tx, true);
      assert.strictEqual(tx.isNativeSegwit(), true);
    });

    it('does not read witnesses of an unsigned transaction', () => {
      // witness data is left unread, hence "unexpected data" in strict mode
      assert.throws(() => {
        Transaction.fromLedgerVaultHex(VECTORS.nativeSegwitSigned, false, true);
      }, /Transaction has unexpected data/);
    });

    it('throws on a signed transaction without witnesses', () => {
      const hex =
        '02000000' + '0001' + INS_HEX + OUTS_HEX + '00' + '00' + LOCKTIME_HEX;
      assert.throws(() => {
        Transaction.fromLedgerVaultHex(hex, true, true);
      }, /Transaction has superfluous witness data/);
    });

    it('throws on trailing data unless _NO_STRICT', () => {
      const buffer = tools.fromHex(VECTORS.nativeSegwitUnsigned + 'deadbeef');
      assert.throws(() => {
        Transaction.fromLedgerVaultBuffer(buffer, false, false, true);
      }, /Transaction has unexpected data/);
      const tx = Transaction.fromLedgerVaultBuffer(buffer, true, false, true);
      assertParsedTx(tx, false);
    });
  });

  describe('values above Number.MAX_SAFE_INTEGER', () => {
    it('accepts output values up to INT64_MAX', () => {
      const tx = new Transaction();
      tx.addOutput(P2PKH_SCRIPT, 0x7fff_ffff_ffff_ffffn);
      assert.throws(() => {
        tx.addOutput(P2PKH_SCRIPT, 0x8000_0000_0000_0000n);
      });
      assert.throws(() => {
        tx.addOutput(P2PKH_SCRIPT, -1n);
      });
    });

    it('round-trips through fromHex', () => {
      const tx = Transaction.fromHex(VECTORS.legacy);
      assert.strictEqual(tx.outs[1].value, BIG_VALUE);
      assert.strictEqual(tx.toHex(), VECTORS.legacy);
    });

    it('computes segwit v0 and v1 signature hashes', () => {
      const tx = Transaction.fromLedgerVaultHex(
        VECTORS.nativeSegwitUnsigned,
        false,
        true,
      );
      assert.strictEqual(
        tools.toHex(
          tx.hashForWitnessV0(
            0,
            tools.fromHex('76a914' + '33'.repeat(20) + '88ac'),
            BIG_VALUE,
            Transaction.SIGHASH_ALL,
          ),
        ),
        'b8c00893a2a7febc0018111affe2bead4f642a0b54bb1d27c49956f79a0939ef',
      );
      assert.strictEqual(
        tools.toHex(
          tx.hashForWitnessV1(
            1,
            [P2WPKH_SCRIPT, P2TR_SCRIPT],
            [BIG_VALUE, 5000n],
            Transaction.SIGHASH_DEFAULT,
          ),
        ),
        'f935c28a65bcebf375cf084e7d048a1c15552edbb0a855a39b28df77f9f77aee',
      );
    });
  });
});
