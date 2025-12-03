# Loading

```html
page: GET /
```

# Step 0
ctx=>assertNoBody("HEAD")(ctx)

# Step 1
ctx=>assertBody("POST")(ctx)

# Step 2
ctx=>assertBody("PUT")(ctx)

# Step 3
ctx=>assertBody("DELETE")(ctx)

# Step 4
ctx=>assertBody("PATCH")(ctx)

# Step 5
ctx=>assertBody("OPTIONS")(ctx)

