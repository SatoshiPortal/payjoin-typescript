import { 
  IPayjoinUriBuilder, 
  IBtcUri, 
  ICheckedBtcUri, 
  IPayjoinUri, 
  IPayjoinUrl, 
} from '../types';
import native from '../native';

export class UriBuilder implements IPayjoinUriBuilder<UriBuilder> {
  private internal: any;

  static create(address: string, endpoint: string): UriBuilder {
    return new UriBuilder(address, endpoint);
  }

  constructor(address: string, endpoint: string) {
    try {
      this.internal = new native.PayjoinUriBuilder(address, endpoint);
    } catch (error) {
      throw new Error(`Failed to create PayjoinUriBuilder: ${error}`);
    }
  }

  amount(amountSat: number): UriBuilder {
    try {
      this.internal = this.internal.amount(amountSat);
      return this;
    } catch (error) {
      throw new Error(`Failed to set amount: ${error}`);
    }
  }

  message(message: string): UriBuilder {
    try {
      this.internal = this.internal.message(message);
      return this;
    } catch (error) {
      throw new Error(`Failed to set message: ${error}`);
    }
  }

  label(label: string): UriBuilder {
    try {
      this.internal = this.internal.label(label);
      return this;
    } catch (error) {
      throw new Error(`Failed to set label: ${error}`);
    }
  }

  disableOutputSubstitution(): UriBuilder {
    try {
      this.internal = this.internal.disableOutputSubstitution();
      return this;
    } catch (error) {
      throw new Error(`Failed to disable output substitution: ${error}`);
    }
  }

  build(): string {
    try {
      return this.internal.build();
    } catch (error) {
      throw new Error(`Failed to build URI: ${error}`);
    }
  }
}

export class BtcUri implements IBtcUri {
  private readonly internal: any;

  constructor(bip21: string) {
    try {
      this.internal = new native.BtcUri(
        bip21,
      );
    } catch (error) {
      throw new Error(`Failed to create BtcUri: ${error}`);
    }
  }

  static tryFrom(bip21: string): BtcUri {
    try {
      const internal = new native.BtcUri.tryFrom(bip21);
      const uri = Object.create(BtcUri.prototype);
      uri.internal = internal;

      return uri;
    } catch (error) {
      throw new Error(`Failed to create URI from BIP21: ${error}`);
    }
  }

  assumeChecked(): CheckedBtcUri {
    return new CheckedBtcUri(this.internal.assumeChecked());
  }
}

export class CheckedBtcUri implements ICheckedBtcUri {
  constructor(private readonly internal: any) {}

  async checkPjSupported(): Promise<PayjoinUri> {
    try {
      const pjUri = await this.internal.checkPjSupported();
      return new PayjoinUri(pjUri);
    } catch (error) {
      throw new Error(`URI does not support Payjoin: ${error}`);
    }
  }
}

export class PayjoinUri implements IPayjoinUri {
  constructor(private readonly internal: any) {}

  amount(): number {
    return this.internal.amount();
  }

  address(): string {
    return this.internal.address();
  }

  endpoint(): PayjoinUrl {
    return new PayjoinUrl(this.internal.endpoint());
  }
}

export class PayjoinUrl implements IPayjoinUrl {
  constructor(private readonly internal: any) {}

  toString(): string {
    return this.internal.toString();
  }
}