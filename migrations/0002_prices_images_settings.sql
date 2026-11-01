-- Numeric key price for sorting, plus the seller that offers it
ALTER TABLE games ADD COLUMN key_price_eur REAL;
ALTER TABLE games ADD COLUMN key_shop TEXT;

-- Best official-store deal from IsThereAnyDeal
ALTER TABLE games ADD COLUMN itad_id TEXT;
ALTER TABLE games ADD COLUMN deal_price REAL;
ALTER TABLE games ADD COLUMN deal_currency TEXT;
ALTER TABLE games ADD COLUMN deal_shop TEXT;
ALTER TABLE games ADD COLUMN deal_url TEXT;
ALTER TABLE games ADD COLUMN deal_cut INTEGER;
ALTER TABLE games ADD COLUMN historical_low REAL;

-- All offers we know about, as JSON: [{kind, shop, price, currency, url, cut}]
ALTER TABLE games ADD COLUMN offers TEXT;

-- Last time the refresher looked at this game, successful or not
ALTER TABLE games ADD COLUMN prices_checked TEXT;

CREATE INDEX IF NOT EXISTS idx_prices_checked ON games(prices_checked);
CREATE INDEX IF NOT EXISTS idx_steam_app_id ON games(steam_app_id);

-- Old key prices came from regexing the first € amount on the page (often a Steam *account*
-- offer or an unrelated price). Drop them; the refresher refills from the parsed offer list.
-- key_price_url is kept so the refresher can go straight to the right page.
UPDATE games SET key_price = NULL, key_price_updated = NULL;

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

DROP TABLE IF EXISTS scrape_cache;
