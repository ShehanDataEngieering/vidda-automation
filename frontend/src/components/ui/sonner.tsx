import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useTheme } from '@/components/theme-provider';

const Toaster = ({ theme: themeProp, ...props }: ToasterProps) => {
  const { theme } = useTheme();
  return (
    <Sonner
      theme={(themeProp ?? theme) as NonNullable<ToasterProps['theme']>}
      className="toaster group"
      richColors
      closeButton
      {...props}
    />
  );
};

export { Toaster };
