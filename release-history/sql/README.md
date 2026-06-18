# Archived Supabase SQL Files

These files are legacy V4.x/V5 prelaunch reference SQL files and are **not** the canonical deployment source.

For production deployment, use the numbered migrations in:

```txt
supabase/migrations/
```

Do not run archived RLS files against production. Some old files may recreate policies that V5 intentionally removed, including public coupon-read policies.
