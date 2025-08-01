declare module "input-otp" {
  import * as React from "react";

  export interface OTPInputContextType {
    slots: {
      char: string;
      isActive: boolean;
      hasFakeCaret: boolean;
    }[];
  }

  export const OTPInputContext: React.Context<OTPInputContextType>;

  export const OTPInput: React.FC<
    React.ComponentPropsWithoutRef<"input"> & {
      containerClassName?: string;
      value?: string;
      onChange?: (value: string) => void;
    }
  >;
}
