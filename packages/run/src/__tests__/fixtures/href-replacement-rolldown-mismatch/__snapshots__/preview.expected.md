# Loading

```html
<button
  id="clickable"
>
  0
</button>
<a
  href="/thing/1?page=0"
>
  Mismatch Search
</a>
<a
  href="/thing/2"
>
  Mismatch Static
</a>
```

# Step 0
ctx=>click(ctx)

```diff
-  0
+  1
-  href="/thing/1?page=0"
+  href="/thing/1?page=1"

```

# Step 1
ctx=>click(ctx)

```diff
-  1
+  2
-  href="/thing/1?page=1"
+  href="/thing/1?page=2"

```

