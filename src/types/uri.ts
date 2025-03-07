export interface IPayjoinUriBuilder<T extends IPayjoinUriBuilder<T>> {
    //new(address: string, endpoint: string): T;
    amount(amountSat: number): T;
    message(message: string): T;
    label(label: string): T;
    disableOutputSubstitution(): T;
    build(): string;
}

export interface IBtcUriConstructor {
    tryFrom(bip21: string): IBtcUri;
    new (internal: any): IBtcUri;
}

export interface IBtcUri {
    assumeChecked(): ICheckedBtcUri;
  }
  
  export interface ICheckedBtcUri {
    checkPjSupported(): Promise<IPayjoinUri>;
  }
  
  export interface IPayjoinUri {
    endpoint(): IPayjoinUrl;
  }
  
  export interface IPayjoinUrl {
    toString(): string;
  }