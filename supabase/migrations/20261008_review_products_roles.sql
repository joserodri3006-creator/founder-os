-- Produktbewertungen, Rollenrechte für Bewertungen
CREATE TABLE IF NOT EXISTS review_product_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  venture venture NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (review_id, product_id)
);
CREATE INDEX IF NOT EXISTS review_product_ratings_product_idx ON review_product_ratings(product_id);
ALTER TABLE review_product_ratings ENABLE ROW LEVEL SECURITY;

-- Manager des Blazed-Ventures dürfen Bewertungen bearbeiten, alle übrigen Manager nicht.
UPDATE user_venture_roles
   SET permissions = COALESCE(permissions, '{}'::jsonb) || jsonb_build_object('reviews', 'edit')
 WHERE role = 'manager' AND venture = 'blazed_outfitters';
UPDATE user_venture_roles
   SET permissions = COALESCE(permissions, '{}'::jsonb) || jsonb_build_object('reviews', 'none')
 WHERE role IN ('manager','employee') AND venture <> 'blazed_outfitters'
   AND NOT (COALESCE(permissions, '{}'::jsonb) ? 'reviews');
