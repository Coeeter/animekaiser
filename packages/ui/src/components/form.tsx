import * as React from "react"
import { Slot } from "radix-ui"
import {
  Controller,
  FormProvider,
  useFormContext,
} from "react-hook-form"
import type {
  ControllerProps,
  FieldPath,
  FieldValues,
} from "react-hook-form"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import { cn } from "@workspace/ui/lib/utils"

const Form = FormProvider

type FormFieldContextValue = {
  name: FieldPath<FieldValues>
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(
  null
)

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

type FormItemContextValue = {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue | null>(null)

function useFormField() {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()

  if (!fieldContext) {
    throw new Error("useFormField must be used within <FormField>")
  }

  if (!itemContext) {
    throw new Error("useFormField must be used within <FormItem>")
  }

  const fieldState = getFieldState(fieldContext.name, formState)
  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

function FormItem({
  className,
  ...props
}: React.ComponentProps<typeof Field>) {
  const id = React.useId()

  return (
    <FormItemContext.Provider value={{ id }}>
      <Field className={cn(className)} {...props} />
    </FormItemContext.Provider>
  )
}

function FormLabel({
  className,
  ...props
}: React.ComponentProps<typeof FieldLabel>) {
  const { error, formItemId } = useFormField()

  return (
    <FieldLabel
      className={cn(error && "text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  )
}

function FormControl({
  ...props
}: React.ComponentProps<typeof Slot.Root>) {
  const { error, formItemId, formDescriptionId, formMessageId } =
    useFormField()

  return (
    <Slot.Root
      aria-describedby={
        error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId
      }
      aria-invalid={!!error}
      data-slot="form-control"
      id={formItemId}
      {...props}
    />
  )
}

function FormDescription({
  ...props
}: React.ComponentProps<typeof FieldDescription>) {
  const { formDescriptionId } = useFormField()

  return (
    <FieldDescription
      data-slot="form-description"
      id={formDescriptionId}
      {...props}
    />
  )
}

function FormMessage({
  children,
  ...props
}: React.ComponentProps<typeof FieldError>) {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error.message ?? "") : children

  if (!body) return null

  return (
    <FieldError data-slot="form-message" id={formMessageId} {...props}>
      {body}
    </FieldError>
  )
}

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
}
