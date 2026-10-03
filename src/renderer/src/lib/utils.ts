import { createCn } from 'cn/config';

/**
 * shadcn's `cn` (clsx + Tailwind class merging), taught the interface's type roles and
 * weights from `index.css`. Without them it reads `text-meta` as a colour, and a colour class
 * passed beside it would drop the role. The `cn` package itself is aliased to this module in
 * the build and the tests, so shadcn components merge the same way.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'heading',
            'editor',
            'title',
            'body',
            'strong',
            'support',
            'meta',
            'eyebrow',
            'tag',
            'key',
          ],
        },
      ],
      'font-weight': [{ font: ['regular', 'control', 'strong', 'tag'] }],
    },
  },
});
