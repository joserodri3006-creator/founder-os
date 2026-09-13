-- Retoureklassen: von Pauschalpreis pro Produkt auf gewichtsbasierte
-- Staffelung umstellen (analog SHIPPING_CLASSES in shop.config.itaba.ts).
-- return_classes wird jetzt direkt in Founder OS als Gewichtstabelle
-- gepflegt statt einzelnen Produkten zugewiesen zu werden.

ALTER TABLE public.return_classes
  ADD COLUMN IF NOT EXISTS max_weight integer; -- Gramm; NULL = oberste/unbegrenzte Stufe

-- is_default ergab bei Pauschalpreis-pro-Produkt Sinn ("Standardklasse für
-- neue Produkte"), ist bei Gewichtsstaffeln aber ohne Bedeutung — die Stufen
-- werden ausschließlich über max_weight sortiert/ausgewählt.
ALTER TABLE public.return_classes
  DROP COLUMN IF EXISTS is_default;

-- Die Produkt->Retoureklasse-Zuordnung entfällt (Retourekosten werden jetzt
-- global anhand des Gesamtgewichts der Rücksendung berechnet, nicht mehr
-- pro einzelnem Produkt hinterlegt).
ALTER TABLE public.products
  DROP COLUMN IF EXISTS return_class_id;

NOTIFY pgrst, 'reload schema';
