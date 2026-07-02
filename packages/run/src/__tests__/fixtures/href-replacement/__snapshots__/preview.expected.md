# Loading

```html
<button
  id="clickable"
>
  0
</button>
<a
  href="/thing/1?q=foo#here1"
>
  Static
</a>
<a
  href="/thing/2?q=bar&page=0#here2"
>
  Dynamic Search
</a>
<a
  href="/thing/3?q=baz#here3"
>
  Opaque Params
</a>
<a
  href="/thing/4?q=quz#here4"
>
  Full Runtime
</a>
```

# Step 0
ctx=>click(ctx)

```diff
-  0
+  1
-  href="/thing/2?q=bar&page=0#here2"
+  href="/thing/2?q=bar&page=1#here2"

```

# Step 1
ctx=>click(ctx)

```diff
-  1
+  2
-  href="/thing/2?q=bar&page=1#here2"
+  href="/thing/2?q=bar&page=2#here2"

```

# Step 2
ctx=>click(ctx)

```diff
-  2
+  3
-  href="/thing/2?q=bar&page=2#here2"
+  href="/thing/2?q=bar&page=3#here2"

```

