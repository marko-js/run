# Loading

```html
<button
  id="add"
>
  Add
</button>
<a
  href="/item/1"
>
  Item 1
</a>
<button
  class="remove"
>
  Remove
</button>
```

# Step 0
ctx=>click(ctx,"#add")

```diff
+</button>
<a
  href="/item/2"
>
  Item 2
</a>
<button
  class="remove"
>
  Remove

```

# Step 1
ctx=>click(ctx,".remove")

```diff
-  href="/item/1"
>
  Item 1
</a>
<button
  class="remove"
>
  Remove
</button>
<a

```

# Step 2
ctx=>click(ctx,".remove")

```diff
-<a
  href="/item/2"
>
  Item 2
</a>
<button
  class="remove"
>
  Remove
</button>+<p>
  Your cart is empty. 
  <a
    href="/search"
  >
    Browse products.
  </a>
</p>
```

