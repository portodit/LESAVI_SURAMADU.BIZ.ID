import * as React from "react";
import { cn } from "@/shared/lib/utils";

interface InputOTPProps extends React.InputHTMLAttributes<HTMLDivElement> {
  maxLength?: number;
  value?: string;
  onChange?: (value: string) => void;
}

interface InputOTPGroupProps extends React.HTMLAttributes<HTMLDivElement> {}

interface InputOTPSlotProps extends React.HTMLAttributes<HTMLDivElement> {
  index: number;
}

const InputOTPContext = React.createContext<{
  slots: { char: string | null; hasFakeCaret: boolean; isActive: boolean }[];
  value: string;
  onChange: (value: string) => void;
  activeIndex: number;
  focusInput: () => void;
}>({
  slots: [],
  value: "",
  onChange: () => {},
  activeIndex: -1,
  focusInput: () => {},
});

const InputOTP = React.forwardRef<HTMLDivElement, InputOTPProps>(
  ({ maxLength = 5, value = "", onChange, className, children, ...props }, ref) => {
    const [activeIndex, setActiveIndex] = React.useState(0);

    const slots = React.useMemo(() => {
      return Array.from({ length: maxLength }, (_, i) => ({
        char: value[i] || null,
        hasFakeCaret: false,
        isActive: i === activeIndex,
      }));
    }, [value, maxLength, activeIndex]);

    const handleChange = React.useCallback(
      (newValue: string) => {
        onChange?.(newValue);
      },
      [onChange]
    );

    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => {
      return inputRef.current?.parentElement as HTMLDivElement;
    });

    const focusInput = React.useCallback(() => {
      inputRef.current?.focus();
    }, []);

    return (
      <InputOTPContext.Provider value={{ slots, value, onChange: handleChange, activeIndex, focusInput }}>
        <div
          ref={ref}
          className={cn("flex items-center gap-2 has-[:disabled]:opacity-50", className)}
          {...props}
        >
          {children}
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={maxLength}
            value={value}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, maxLength);
              onChange?.(val);
              setActiveIndex(Math.min(val.length, maxLength - 1));
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && value.length > 0) {
                const newIndex = Math.max(0, value.length - 1);
                setActiveIndex(newIndex);
              } else if (e.key === "ArrowLeft") {
                setActiveIndex((i) => Math.max(0, i - 1));
              } else if (e.key === "ArrowRight") {
                setActiveIndex((i) => Math.min(maxLength - 1, i + 1));
              }
            }}
            onFocus={() => setActiveIndex(value.length < maxLength ? value.length : maxLength - 1)}
            className="sr-only absolute opacity-0 pointer-events-none"
            style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", borderWidth: 0 }}
          />
        </div>
      </InputOTPContext.Provider>
    );
  }
);
InputOTP.displayName = "InputOTP";

const InputOTPGroup = React.forwardRef<HTMLDivElement, InputOTPGroupProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-[10px]", className)} {...props} />
  )
);
InputOTPGroup.displayName = "InputOTPGroup";

const InputOTPSlot = React.forwardRef<HTMLDivElement, InputOTPSlotProps>(
  ({ index, className, ...props }, ref) => {
    const { slots, focusInput } = React.useContext(InputOTPContext);
    const slot = slots[index] ?? { char: null, hasFakeCaret: false, isActive: false };

    return (
      <div
        ref={ref}
        onClick={focusInput}
        className={cn(
          "relative flex h-12 w-12 items-center justify-center border-2 border-[#e5e7eb] rounded-xl bg-[#f9fafb] text-sm font-bold transition-all",
          slot.isActive && "border-[#cc0000] ring-2 ring-red-100 z-10",
          slot.char && "border-[#cc0000] bg-red-50 text-[#cc0000]",
          className
        )}
        {...props}
      >
        {slot.char}
        {slot.hasFakeCaret && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
          </div>
        )}
      </div>
    );
  }
);
InputOTPSlot.displayName = "InputOTPSlot";

const InputOTPSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ ...props }, ref) => <div ref={ref} role="separator" {...props} />
);
InputOTPSeparator.displayName = "InputOTPSeparator";

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
