import { Injectable, Logger } from '@nestjs/common';

export interface StoreInstalledEvent {
  storeId: string;
  shopDomain: string;
}

/**
 * Thin typed event seam (M02 emits `store.installed`). No consumer yet — a real bus/
 * queue arrives with the sync work (Phase 2). Logs identifiers only; never a token.
 */
@Injectable()
export class StoreEventsService {
  private readonly logger = new Logger('StoreEvents');

  storeInstalled(event: StoreInstalledEvent): void {
    this.logger.log(
      { event: 'store.installed', storeId: event.storeId, shopDomain: event.shopDomain },
      'store.installed',
    );
  }
}
