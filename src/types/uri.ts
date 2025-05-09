export interface IPayjoinUriBuilder<T extends IPayjoinUriBuilder<T>> {
    //new(address: string, endpoint: string): T;
    amount(amountSat: number): T;
    message(message: string): T;
    label(label: string): T;
    disableOutputSubstitution(): T;
    build(): string;
}

export interface IBtcUri {
  assumeChecked(): ICheckedBtcUri;
}
  
  export interface ICheckedBtcUri {
    checkPjSupported(): Promise<IPayjoinUri>;
  }
  
  export interface IPayjoinUri {
    amount(): number;
    address(): string;
    endpoint(): IPayjoinUrl;
    exp(): bigint;
  }
  
  export interface IPayjoinUrl {
    toString(): string;
  }