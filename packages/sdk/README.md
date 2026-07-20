# @usebugreport/browser

Browser SDK for usebugreport session capture and bug report submit.

## Install

```bash
npm install @usebugreport/browser
```

## Usage

```typescript
import { init, submit, dispose } from "@usebugreport/browser";

init({
  projectKey: "ubr_ingest_…", // from project settings
  bufferSeconds: 60,
  onSubmit: async (result) => {
    // payload assembled locally — HTTP upload comes in a later release
    console.log(result.payload);
  },
});

const result = await submit({
  title: "Checkout button unresponsive",
  description: "Clicked Add to cart; nothing happened.",
});

dispose();
```

Or use the namespace object:

```typescript
import { useBugReport } from "@usebugreport/browser";

useBugReport.init({ projectKey: "ubr_ingest_…" });
await useBugReport.submit({ title: "Bug title" });
useBugReport.dispose();
```
