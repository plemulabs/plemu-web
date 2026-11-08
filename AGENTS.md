# Repository guidelines

## Git identity

Use `0xbae` and `94998349+0xbae@users.noreply.github.com` for author and committer. Configure this identity locally in each checkout:

```sh
git config --local user.name 0xbae
git config --local user.email 94998349+0xbae@users.noreply.github.com
```

Push with the authorized Plemu SSH identity. Check the destination and commit attribution before pushing.

## Checks

```sh
npm run typecheck
npm test
npm run format:check
npm run build
```

Keep legal documents consistent with their pinned source and retain third-party notices.
