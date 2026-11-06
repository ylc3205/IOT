import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email không được để trống' })
    .email('Định dạng email không hợp lệ')
    .trim()
    .toLowerCase(),
  password: z
    .string({ required_error: 'Mật khẩu không được để trống' })
    .min(6, 'Mật khẩu phải chứa ít nhất 6 ký tự')
});

export type LoginInput = z.infer<typeof loginSchema>;

