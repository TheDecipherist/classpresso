# Website Sync - v1.2.0

## New Features

### CSS Layer Support
Added `cssLayer` config option for Tailwind v4 and modern CSS layer compatibility.

```javascript
// classpresso.config.js
export default {
  cssLayer: 'utilities',  // wraps output in @layer utilities { }
}
```

**Output:**
```css
/* Classpresso Consolidated Classes */
@layer utilities {
  .cp-a1b2c {
    display: flex;
    align-items: center;
  }
}
```

- Set to a layer name string (e.g., `'utilities'`, `'components'`) to wrap consolidated CSS
- Set to `false` (default) for no layer wrapping (higher specificity)
- Useful for CMS integrations and strict CSS layer control

### Debug Data Attributes
Added `dataAttributes` config option to help debug consolidated classes in DevTools.

```javascript
// classpresso.config.js
export default {
  dataAttributes: true,  // adds data-cp-original to elements
}
```

**Output:**
```html
<!-- Before -->
<button class="flex items-center justify-center rounded-md">Submit</button>

<!-- After with dataAttributes: true -->
<button class="cp-a1b2c" data-cp-original="flex items-center justify-center rounded-md">Submit</button>
```

- When enabled, adds `data-cp-original` attribute showing the original classes
- Visible in browser DevTools Elements panel
- Useful for debugging and development
- Disable for production builds to save bytes

## Config Reference Update

Add these options to the config documentation:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cssLayer` | `string \| false` | `false` | Wrap consolidated CSS in `@layer`. Set to layer name or `false` to disable. |
| `dataAttributes` | `boolean` | `false` | Add `data-cp-original` attribute with original classes for debugging. |
