import { none } from 'eve/channels/auth';
import { mcpChannel } from 'eve/channels/mcp';

export default mcpChannel({ auth: none(), agent: false, tools: true, route: '/mcp' });
