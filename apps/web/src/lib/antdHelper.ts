import { message as staticMessage } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';

let message: MessageInstance = staticMessage;

export const setAntdContext = (instances: { message: MessageInstance }) => {
    message = instances.message;
};

export { message };
