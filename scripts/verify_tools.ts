// 验证 extractToolMessageContent + ToolPairBubble 渲染
import { extractToolMessageContent, coerceToolInput } from '../app/lib/toolInputShape';
import { getToolPurpose } from '../app/lib/toolPurpose';
import { getWrittenLength, formatWrittenLength, getActionVerb } from '../app/lib/toolSummary';

const sample = '{"lc":1,"type":"constructor","id":["langchain_core","messages","ToolMessage"],"kwargs":{"status":"success","content":"项目设定「title」已更新。","tool_call_id":"call_195907800ed542639bcf5634","name":"update_project_field","metadata":{"versions":{"@langchain/core":"1.1.48"}},"additional_kwargs":{},"response_metadata":{}}}';

console.log('=== extractToolMessageContent ===');
console.log('input :', sample);
console.log('output:', extractToolMessageContent(sample));

// generate_outline 实际 input（langchain 工具 schema）
const generateOutlineInput = {
  projectId: 'proj_3ae40c3f-993f-4c96-8a76-4be7c5c8f5c7',
  numChapters: 10,
};

console.log('\n=== generate_outline 工具 ===');
console.log('input raw       :', generateOutlineInput);
console.log('coerced         :', coerceToolInput(generateOutlineInput));
console.log('purpose         :', getToolPurpose('generate_outline', generateOutlineInput));
console.log('verb            :', getActionVerb('generate_outline'));
console.log('written length  :', getWrittenLength('generate_outline', generateOutlineInput, '已生成 2000 字'));
console.log('label           :', formatWrittenLength(getWrittenLength('generate_outline', generateOutlineInput, '已生成 2000 字'), getActionVerb('generate_outline')));

// delegate_to_planner 类型
const delegateInput = {
  projectId: 'proj_3ae40c3f-993f-4c96-8a76-4be7c5c8f5c7',
  task: '请策划更新人设',
};

console.log('\n=== delegate_to_planner 工具 ===');
console.log('purpose:', getToolPurpose('delegate_to_planner', delegateInput));

// create_character
const charInput = { projectId: 'p', name: '林远', bio: '剑客', role: '主角' };
console.log('\n=== create_character 工具 ===');
console.log('input :', charInput);
console.log('purpose:', getToolPurpose('create_character', charInput));
console.log('length :', getWrittenLength('create_character', charInput, null));
console.log('label  :', formatWrittenLength(getWrittenLength('create_character', charInput, null), getActionVerb('create_character')));
