# Loading

```html
<button>
  0
</button>
<a
  href="/thing/0"
>
  Link
</a>
```

# Step 0
ctx=>click(ctx)

```diff
-  0
+  1
-  href="/thing/0"
+  href="/thing/1"

```

# Step 1
ctx=>click(ctx)

```diff
-  1
+  2
-  href="/thing/1"
+  href="/thing/2"

```

# Step 2
ctx=>click(ctx)

```diff
-  2
+  3
-  href="/thing/2"
+  href="/thing/3"

```

