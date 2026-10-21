declare const validate: ((data: unknown) => boolean) & { errors?: Array<{ instancePath: string; message?: string }> | null };
export = validate;
