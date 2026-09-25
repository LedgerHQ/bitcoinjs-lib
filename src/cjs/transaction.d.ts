export declare function varSliceSize(someScript: Uint8Array): number;
export interface Output {
    script: Uint8Array;
    value: bigint;
}
export interface Input {
    hash: Uint8Array;
    index: number;
    script: Uint8Array;
    sequence: number;
    witness: Uint8Array[];
}
/**
 * Represents a Bitcoin transaction.
 */
export declare class Transaction {
    static readonly DEFAULT_SEQUENCE = 4294967295;
    static readonly SIGHASH_DEFAULT = 0;
    static readonly SIGHASH_ALL = 1;
    static readonly SIGHASH_NONE = 2;
    static readonly SIGHASH_SINGLE = 3;
    static readonly SIGHASH_ANYONECANPAY = 128;
    static readonly SIGHASH_OUTPUT_MASK = 3;
    static readonly SIGHASH_INPUT_MASK = 128;
    static readonly ADVANCED_TRANSACTION_MARKER = 0;
    static readonly ADVANCED_TRANSACTION_FLAG = 1;
    static fromBuffer(buffer: Uint8Array, _NO_STRICT?: boolean): Transaction;
    /**
     * Parses a transaction in the Ledger Vault format: marker & flag are
     * present for native segwit transactions even when they are unsigned,
     * and witnesses are only read for signed transactions.
     */
    static fromLedgerVaultBuffer(buffer: Uint8Array, _NO_STRICT?: boolean, isSigned?: boolean, isNativeSegwit?: boolean): Transaction;
    static fromLedgerVaultHex(hex: string, isSigned: boolean, isNativeSegwit: boolean): Transaction;
    static fromHex(hex: string): Transaction;
    static isCoinbaseHash(buffer: Uint8Array): boolean;
    version: number;
    locktime: number;
    ins: Input[];
    outs: Output[];
    nativeSegwit: boolean;
    isCoinbase(): boolean;
    addInput(hash: Uint8Array, index: number, sequence?: number, scriptSig?: Uint8Array): number;
    addOutput(scriptPubKey: Uint8Array, value: bigint): number;
    hasWitnesses(): boolean;
    stripWitnesses(): void;
    setNativeSegwit(ns: boolean): void;
    isNativeSegwit(): boolean;
    weight(): number;
    virtualSize(): number;
    byteLength(_ALLOW_WITNESS?: boolean): number;
    clone(): Transaction;
    /**
     * Hash transaction for signing a specific input.
     *
     * Bitcoin uses a different hash for each signed transaction input.
     * This method copies the transaction, makes the necessary changes based on the
     * hashType, and then hashes the result.
     * This hash can then be used to sign the provided transaction input.
     */
    hashForSignature(inIndex: number, prevOutScript: Uint8Array, hashType: number): Uint8Array;
    hashForWitnessV1(inIndex: number, prevOutScripts: Uint8Array[], values: bigint[], hashType: number, leafHash?: Uint8Array, annex?: Uint8Array): Uint8Array;
    hashForWitnessV0(inIndex: number, prevOutScript: Uint8Array, value: bigint, hashType: number): Uint8Array;
    getHash(forWitness?: boolean): Uint8Array;
    getId(): string;
    toBuffer(buffer?: Uint8Array, initialOffset?: number): Uint8Array;
    toHex(): string;
    setInputScript(index: number, scriptSig: Uint8Array): void;
    setWitness(index: number, witness: Uint8Array[]): void;
    private __toBuffer;
}
