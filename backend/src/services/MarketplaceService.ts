export class MarketplaceService {
  async listListings(): Promise<any[]> {
    return [{ id: 1, category: 'Restaurant', isActive: true }];
  }
}
