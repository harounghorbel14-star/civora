/** Public interface of the catalogue module. Other modules may import ONLY from this file. */
export { CatalogueModule } from './catalogue.module';
export { SERVICE_PAGES } from './tokens';

/** Published service pages (P5): another module asks whether a page exists before linking to it (P4-F6). */
export interface ServicePages {
  /** true when /<lang>/services/<slug>/ is a published service page. */
  published(slug: string): Promise<boolean>;
}
