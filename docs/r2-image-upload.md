# R2 image upload setup

UchiLog stores diary images in Cloudflare R2 through the `DIARY_IMAGES` Worker binding.

## Buckets

Create one bucket for production and one for development.

```bash
npx wrangler r2 bucket create uchilog-diary-images
npx wrangler r2 bucket create uchilog-dev-diary-images
```

The Worker binding is configured in `wrangler.jsonc`.

```jsonc
"r2_buckets": [
  {
    "binding": "DIARY_IMAGES",
    "bucket_name": "uchilog-diary-images"
  }
]
```

The `dev` environment uses `uchilog-dev-diary-images` with the same binding name.

## Type generation

After changing Cloudflare bindings, regenerate the local env type file.

```bash
npm run cf-typegen
```

## Upload flow

1. The browser loads the selected image.
2. The browser creates two WebP files:
   - thumbnail: max width 400px, quality 75
   - display image: max width 1600px, quality 80
3. The browser sends both files to `/api/images/upload`.
4. The upload route checks the Supabase session before writing to R2.
5. The diary body stores the display image URL as Markdown.
6. Timeline thumbnails use the matching thumbnail URL.

R2 objects are kept private. Images are read through `/api/images/...`, so public bucket access is not required.
