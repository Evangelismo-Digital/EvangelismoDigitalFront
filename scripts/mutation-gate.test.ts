import { describe, expect, it } from 'vitest'
import { changedRanges } from './mutation-gate'

const diff = `diff --git a/src/util/a.ts b/src/util/a.ts
--- a/src/util/a.ts
+++ b/src/util/a.ts
@@ -3 +3 @@ x
-old
+new
@@ -10,0 +11,4 @@ y
+a
@@ -20,2 +24,0 @@ z
-gone
diff --git a/src/util/a.test.ts b/src/util/a.test.ts
+++ b/src/util/a.test.ts
@@ -1 +1,2 @@
diff --git a/src/main.tsx b/src/main.tsx
+++ b/src/main.tsx
@@ -1 +1 @@
diff --git a/src/components/New.tsx b/src/components/New.tsx
--- /dev/null
+++ b/src/components/New.tsx
@@ -0,0 +1,7 @@
`

describe('changedRanges', () => {
  it('keeps added/changed hunks of mutable source files only', () => {
    expect(changedRanges(diff)).toEqual([
      'src/util/a.ts:3-3',
      'src/util/a.ts:11-14',
      'src/components/New.tsx:1-7'
    ])
  })

  it('returns nothing for an empty diff', () => {
    expect(changedRanges('')).toEqual([])
  })
})
