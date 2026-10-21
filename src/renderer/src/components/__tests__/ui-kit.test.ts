import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppButton as DirectAppButton } from '../kit/AppButton';
import { AppMenuContent as DirectAppMenuContent } from '../kit/AppMenu';
import { DialogFrameHeader as DirectDialogFrameHeader } from '../kit/DialogFrame';
import { Text as DirectText } from '../kit/Text';
import { textVariantClasses as directTextVariantClasses } from '../kit/textVariants';
import {
  AppButton,
  AppInput,
  AppMenuContent,
  Badge,
  DialogFrameHeader,
  Text,
  textVariantClasses,
  type TextVariant,
} from '../ui-kit';

describe('ui-kit', () => {
  it('re-exports the implementations without wrapping them', () => {
    expect(AppButton).toBe(DirectAppButton);
    expect(AppMenuContent).toBe(DirectAppMenuContent);
    expect(DialogFrameHeader).toBe(DirectDialogFrameHeader);
    expect(Text).toBe(DirectText);
    expect(textVariantClasses).toBe(directTextVariantClasses);
  });

  it('exposes the same text roles for elements that cannot use Text', () => {
    const variant: TextVariant = 'meta';
    const markup = renderToStaticMarkup(
      createElement('span', { className: textVariantClasses(variant) }, '42')
    );
    expect(markup).toBe(renderToStaticMarkup(createElement(Text, { variant }, '42')));
  });

  it('supports composing controls and presentation primitives from one import', () => {
    const markup = renderToStaticMarkup(
      createElement(
        'form',
        null,
        createElement(
          Text<'label'>,
          { as: 'label', variant: 'body', htmlFor: 'resume-name' },
          'Name'
        ),
        createElement(AppInput, { id: 'resume-name', defaultValue: 'Example resume' }),
        createElement(Badge, null, 'Draft'),
        createElement(AppButton, { type: 'submit' }, 'Save')
      )
    );

    expect(markup).toContain('<label');
    expect(markup).toContain('for="resume-name"');
    expect(markup).toContain('value="Example resume"');
    expect(markup).toContain('Draft</span>');
    expect(markup).toContain('type="submit"');
    expect(markup).toContain('Save</button>');
  });
});
