import React, {useState} from 'react';
import {Book, ChevronDown, ChevronRight, Copy, Check, Code, FileJson} from 'lucide-react';

// API 接口定义
const API_ENDPOINTS = [
    {
        group: '查询接口',
        description: '查询可用的渠道和能力信息',
        apis: [
            {
                method: 'GET',
                path: '/v1/channels',
                name: '获取渠道列表',
                description: '获取所有可用的渠道编码列表',
                auth: 'Bearer Token',
                pathParams: [],
                bodyParams: [],
                requestExample: null,
                responseExample: `{
  "code": 0,
  "message": "success",
  "data": ["midjourney", "runway", "sora"]
}`,
            },
            {
                method: 'GET',
                path: '/v1/capabilities',
                name: '获取能力列表',
                description: '获取所有可用的能力列表及其支持的渠道，可通过 channel 或 type 参数筛选',
                auth: 'Bearer Token',
                pathParams: [],
                bodyParams: [
                    {
                        name: 'channel',
                        type: 'string',
                        required: false,
                        description: '(Query) 渠道类型，筛选该渠道支持的能力'
                    },
                    {
                        name: 'type',
                        type: 'string',
                        required: false,
                        description: '(Query) 能力类型，可选值: image, video, chat, other'
                    },
                ],
                requestExample: null,
                responseExample: `{
  "code": 0,
  "message": "success",
  "data": [
    {
      "code": "text2img_mj",
      "name": "MJ文生图",
      "type": "image",
      "description": "使用Midjourney生成图片",
      "channels": ["midjourney"]
    },
    {
      "code": "text2img_banana",
      "name": "香蕉文生图",
      "type": "image",
      "description": "使用香蕉模型生成图片",
      "channels": ["banana"]
    },
    {
      "code": "img2video",
      "name": "图生视频",
      "type": "video",
      "description": "根据图片生成视频",
      "channels": ["runway", "kling"]
    }
  ]
}`,
            },
        ],
    },
    {
        group: '能力调用',
        description: '统一的能力调用接口，支持文生图、图生视频等多种能力',
        apis: [
            {
                method: 'POST',
                path: '/v1/capabilities/:capability',
                name: '提交任务',
                description: '调用指定能力创建任务，如 /v1/capabilities/text2img_mj',
                auth: 'Bearer Token',
                pathParams: [
                    {
                        name: 'capability',
                        type: 'string',
                        required: true,
                        description: '能力编码，如 text2img_mj, img2video'
                    },
                ],
                bodyParams: [
                    {name: 'channel', type: 'string', required: false, description: '渠道类型（可选，用于指定特定渠道）'},
                    {name: 'callback_url', type: 'string', required: false, description: '任务完成后的回调地址'},
                    {name: 'prompt', type: 'string', required: true, description: '提示词'},
                    {name: 'negative_prompt', type: 'string', required: false, description: '负向提示词'},
                    {
                        name: 'aspect_ratio',
                        type: 'string',
                        required: false,
                        description: '宽高比: 1:1, 16:9, 9:16, 4:3, 3:4'
                    },
                    {name: 'width', type: 'integer', required: false, description: '宽度（与 aspect_ratio 二选一）'},
                    {name: 'height', type: 'integer', required: false, description: '高度（与 aspect_ratio 二选一）'},
                    {name: 'seed', type: 'integer', required: false, description: '随机种子'},
                    {name: 'steps', type: 'integer', required: false, description: '生成步数'},
                    {name: 'cfg_scale', type: 'number', required: false, description: 'CFG 强度'},
                ],
                requestExample: `{
  "prompt": "a cat sitting on a chair, high quality",
  "negative_prompt": "blurry, low quality",
  "aspect_ratio": "16:9",
  "callback_url": "https://your-domain.com/callback"
}`,
                responseExample: `{
  "code": 0,
  "message": "success",
  "data": {
    "task_no": "task_abc123def456",
    "status": "pending",
    "capability": "text2img_mj"
  }
}`,
            },
        ],
    },
    {
        group: '任务管理',
        description: '查询和管理已创建的任务',
        apis: [
            {
                method: 'GET',
                path: '/v1/tasks/:task_no',
                name: '查询任务',
                description: '根据任务编号查询任务状态和结果',
                auth: 'Bearer Token',
                pathParams: [
                    {name: 'task_no', type: 'string', required: true, description: '任务编号'},
                ],
                bodyParams: [],
                requestExample: null,
                responseExample: `{
  "code": 0,
  "message": "success",
  "data": {
    "task_no": "task_abc123def456",
    "status": "success",
    "channel": "midjourney",
    "capability": "text2img",
    "model": "v6",
    "progress": 100,
    "result": {
      "images": [
        {
          "url": "https://cdn.example.com/result.png",
          "width": 1920,
          "height": 1080
        }
      ]
    },
    "cost": 0.1,
    "created_at": "2024-01-01T00:00:00Z",
    "completed_at": "2024-01-01T00:00:30Z"
  }
}`,
            },
            {
                method: 'POST',
                path: '/v1/tasks/:task_no/cancel',
                name: '取消任务',
                description: '取消正在处理中的任务',
                auth: 'Bearer Token',
                pathParams: [
                    {name: 'task_no', type: 'string', required: true, description: '任务编号'},
                ],
                bodyParams: [],
                requestExample: null,
                responseExample: `{
  "code": 0,
  "message": "success",
  "data": {
    "task_no": "task_abc123def456",
    "status": "cancelled"
  }
}`,
            },
        ],
    },
];

// 状态说明
const STATUS_DEFINITIONS = [
    {status: 'pending', description: '等待处理'},
    {status: 'processing', description: '处理中'},
    {status: 'success', description: '处理成功'},
    {status: 'failed', description: '处理失败'},
    {status: 'cancelled', description: '已取消'},
];

// 错误码说明
const ERROR_CODES = [
    {code: 0, description: '成功'},
    {code: 400, description: '请求参数错误'},
    {code: 401, description: '未授权，Token 无效或已过期'},
    {code: 403, description: '无权限访问'},
    {code: 404, description: '资源不存在'},
    {code: 429, description: '请求过于频繁'},
    {code: 500, description: '服务器内部错误'},
];

const MethodBadge: React.FC<{ method: string }> = ({method}) => {
    const colors: Record<string, string> = {
        GET: 'bg-green-100 text-green-700',
        POST: 'bg-blue-100 text-blue-700',
        PUT: 'bg-yellow-100 text-yellow-700',
        DELETE: 'bg-red-100 text-red-700',
    };
    return (
        <span className={`px-2 py-1 rounded text-xs font-bold ${colors[method]}`}>
            {method}
        </span>
    );
};

const CopyButton: React.FC<{ text: string }> = ({text}) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            title="复制"
        >
            {copied ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>}
        </button>
    );
};

const CodeBlock: React.FC<{ code: string; title?: string }> = ({code, title}) => (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
        {title && (
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                <span className="text-xs text-gray-400">{title}</span>
                <CopyButton text={code}/>
            </div>
        )}
        <pre className="p-4 text-sm text-gray-300 overflow-x-auto">
            <code>{code}</code>
        </pre>
    </div>
);

const ApiEndpoint: React.FC<{ api: typeof API_ENDPOINTS[0]['apis'][0] }> = ({api}) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    {expanded ? <ChevronDown size={18} className="text-gray-400"/> :
                        <ChevronRight size={18} className="text-gray-400"/>}
                    <MethodBadge method={api.method}/>
                    <code className="text-sm font-mono text-gray-700">{api.path}</code>
                    <span className="text-sm text-gray-500">- {api.name}</span>
                </div>
            </div>

            {expanded && (
                <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
                    <p className="text-sm text-gray-600">{api.description}</p>

                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500">认证方式:</span>
                        <code className="px-2 py-0.5 bg-gray-200 rounded text-xs">{api.auth}</code>
                    </div>

                    {api.pathParams.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">路径参数</h4>
                            <table className="w-full text-sm">
                                <thead>
                                <tr className="bg-gray-100">
                                    <th className="px-3 py-2 text-left font-medium text-gray-600">参数名</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600">类型</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600">必填</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600">说明</th>
                                </tr>
                                </thead>
                                <tbody>
                                {api.pathParams.map(param => (
                                    <tr key={param.name} className="border-t border-gray-200">
                                        <td className="px-3 py-2 font-mono text-indigo-600">{param.name}</td>
                                        <td className="px-3 py-2 text-gray-600">{param.type}</td>
                                        <td className="px-3 py-2">
                                            {param.required ? (
                                                <span className="text-red-500">是</span>
                                            ) : (
                                                <span className="text-gray-400">否</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-gray-600">{param.description}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {api.bodyParams.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">请求参数 (Body)</h4>
                            <table className="w-full text-sm">
                                <thead>
                                <tr className="bg-gray-100">
                                    <th className="px-3 py-2 text-left font-medium text-gray-600">参数名</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600">类型</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600">必填</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600">说明</th>
                                </tr>
                                </thead>
                                <tbody>
                                {api.bodyParams.map(param => (
                                    <tr key={param.name} className="border-t border-gray-200">
                                        <td className="px-3 py-2 font-mono text-indigo-600">{param.name}</td>
                                        <td className="px-3 py-2 text-gray-600">{param.type}</td>
                                        <td className="px-3 py-2">
                                            {param.required ? (
                                                <span className="text-red-500">是</span>
                                            ) : (
                                                <span className="text-gray-400">否</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-gray-600">{param.description}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {api.requestExample && (
                            <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">请求示例</h4>
                                <CodeBlock code={api.requestExample} title="Request Body"/>
                            </div>
                        )}
                        {api.responseExample && (
                            <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">响应示例</h4>
                                <CodeBlock code={api.responseExample} title="Response"/>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const ApiDocs: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'endpoints' | 'status' | 'errors'>('endpoints');

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">API 文档</h1>
                    <p className="text-gray-500 mt-1">统一能力调用接口文档</p>
                </div>
            </div>

            {/* 快速开始 */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                    <Book size={24}/>
                    <h2 className="text-lg font-bold">快速开始</h2>
                </div>
                <div className="space-y-3 text-sm text-indigo-100">
                    <p>1. 在「令牌管理」页面创建 API Token</p>
                    <p>2. 在请求头中添加认证信息：<code className="bg-white/20 px-2 py-0.5 rounded">Authorization: Bearer
                        YOUR_TOKEN</code></p>
                    <p>3. 调用能力接口创建任务，然后轮询或等待回调获取结果</p>
                </div>
                <div className="mt-4">
                    <CodeBlock
                        code={`curl -X POST "https://api.example.com/v1/capabilities/text2img" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"channel": "midjourney", "prompt": "a beautiful sunset"}'`}
                        title="示例请求"
                    />
                </div>
            </div>

            {/* 标签页 */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('endpoints')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'endpoints'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <Code size={16}/>
                        接口列表
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('status')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'status'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <FileJson size={16}/>
                        状态说明
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('errors')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'errors'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <FileJson size={16}/>
                        错误码
                    </div>
                </button>
            </div>

            {/* 接口列表 */}
            {activeTab === 'endpoints' && (
                <div className="space-y-6">
                    {API_ENDPOINTS.map(group => (
                        <div key={group.group} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{group.group}</h3>
                            <p className="text-sm text-gray-500 mb-4">{group.description}</p>
                            <div className="space-y-3">
                                {group.apis.map(api => (
                                    <ApiEndpoint key={api.path + api.method} api={api}/>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 状态说明 */}
            {activeTab === 'status' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">任务状态说明</h3>
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="bg-gray-50">
                            <th className="px-4 py-3 text-left font-medium text-gray-600">状态值</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">说明</th>
                        </tr>
                        </thead>
                        <tbody>
                        {STATUS_DEFINITIONS.map(item => (
                            <tr key={item.status} className="border-t border-gray-200">
                                <td className="px-4 py-3">
                                    <code className="px-2 py-1 bg-gray-100 rounded text-indigo-600">{item.status}</code>
                                </td>
                                <td className="px-4 py-3 text-gray-600">{item.description}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 错误码 */}
            {activeTab === 'errors' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">错误码说明</h3>
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="bg-gray-50">
                            <th className="px-4 py-3 text-left font-medium text-gray-600">错误码</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">说明</th>
                        </tr>
                        </thead>
                        <tbody>
                        {ERROR_CODES.map(item => (
                            <tr key={item.code} className="border-t border-gray-200">
                                <td className="px-4 py-3">
                                    <code
                                        className={`px-2 py-1 rounded ${item.code === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {item.code}
                                    </code>
                                </td>
                                <td className="px-4 py-3 text-gray-600">{item.description}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>

                    <div className="mt-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">错误响应示例</h4>
                        <CodeBlock
                            code={`{
  "code": 400,
  "message": "参数错误: prompt 不能为空",
  "data": null
}`}
                            title="Error Response"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApiDocs;
