import { AlertCircle } from 'lucide-react';
import { Text } from '@/components/Text';
import { textVariantClasses } from '@/components/textVariants';
import { cn } from '@/lib/utils';

/** A typed address as a row: where it goes, and why it can't when it can't. */
export function AddressRow({
  address,
  description,
  isError,
}: {
  address: string;
  description: string;
  isError?: boolean;
}) {
  return (
    <>
      {isError && <AlertCircle className="text-del" />}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn(textVariantClasses('meta'), 'truncate text-current')}>
          Go to {address}
        </span>
        <Text
          variant="secondary"
          className={cn('mt-px', !isError && 'hidden group-data-[selected=true]:block')}
        >
          {description}
        </Text>
      </span>
    </>
  );
}
