-- 1 手あたりの得点（score / swaps）を出すため、成功した入れ替えの回数を記録に持つ。
-- それ以前の記録は NULL のままにし、画面ではその行の 1 手あたりを出さない。
ALTER TABLE scores ADD COLUMN swaps INTEGER;
