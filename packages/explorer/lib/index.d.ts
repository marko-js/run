export declare function start(port: number): Promise<{
  port: number;
  close(): Promise<void>;
}>;
