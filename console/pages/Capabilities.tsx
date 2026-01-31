import React, { useEffect, useState } from 'react';
import {Plus, Settings, Cpu, Edit2, Trash2, ChevronDown, ChevronRight, X, Power, RefreshCw} from 'lucide-react';
import {
    fetchCapabilities, fetchChannelCapabilities, fetchChannels,
    createCapability, updateCapability, deleteCapability,
    createChannelCapability, updateChannelCapability, deleteChannelCapability
} from '../services/api';
import { Capability, ChannelCapability, Channel } from '../types';

const RESULT_MODES = [
    {value: 'sync', label: '同步'},
    {value: 'poll', label: '轮询'},
    {value: 'callback', label: '回调'},
];

// 系统标准参数字段定义
const STANDARD_PARAMS: Record<string, { name: string; type: string; enumValues?: string[] }> = {
    prompt: {name: '提示词', type: 'string'},
    negative_prompt: {name: '负向提示词', type: 'string'},
    aspect_ratio: {name: '宽高比', type: 'enum', enumValues: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3']},
    width: {name: '宽度', type: 'number'},
    height: {name: '高度', type: 'number'},
    seed: {name: '随机种子', type: 'number'},
    steps: {name: '生成步数', type: 'number'},
    cfg_scale: {name: 'CFG强度', type: 'number'},
    image_urls: {name: '图片URL列表', type: 'array'},
    strength: {name: '变化强度', type: 'number'},
    duration: {name: '时长(秒)', type: 'number'},
    fps: {name: '帧率', type: 'enum', enumValues: ['24', '30', '60']},
    style: {name: '风格', type: 'enum', enumValues: ['realistic', 'anime', 'cartoon']},
    callback_url: {name: '回调地址', type: 'string'},
};

// 系统标准响应字段定义
const STANDARD_RESPONSE: Record<string, { name: string; type: string; enumValues?: string[] }> = {
    task_id: {name: '任务ID', type: 'string'},
    status: {name: '状态', type: 'enum', enumValues: ['pending', 'processing', 'success', 'failed', 'cancelled']},
    progress: {name: '进度', type: 'number'},
    image_url: {name: '图片URL', type: 'string'},
    video_url: {name: '视频URL', type: 'string'},
    error: {name: '错误信息', type: 'string'},
};

// 轮询请求参数字段定义
const POLL_PARAMS: Record<string, { name: string; type: string }> = {
    task_id: {name: '任务ID', type: 'string'},
};

// 系统标准状态值
const STANDARD_STATUS_VALUES = ['pending', 'processing', 'success', 'failed', 'cancelled'];

// 字段映射行组件
const FieldMappingRow: React.FC<{
    stdField: string;
    stdName: string;
    vendorField: string;
    onChange: (value: string) => void;
    onRemove: () => void;
}> = ({stdField, stdName, vendorField, onChange, onRemove}) => (
    <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 px-3 py-2 bg-gray-50 rounded-lg text-sm">
            <span className="text-gray-600">{stdName}</span>
            <code className="ml-2 text-xs text-gray-400">{stdField}</code>
        </div>
        <span className="text-gray-400">→</span>
        <input
            type="text"
            value={vendorField}
            onChange={e => onChange(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="三方字段名或路径"
        />
        <button type="button" onClick={onRemove}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
            <X size={14}/>
        </button>
    </div>
);

// 值映射行组件
const ValueMappingRow: React.FC<{
    stdValue: string;
    vendorValue: string;
    onChange: (value: string) => void;
    onRemove: () => void;
}> = ({stdValue, vendorValue, onChange, onRemove}) => (
    <div className="flex items-center gap-2 mb-2">
        <div className="w-32 px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-600">{stdValue}</div>
        <span className="text-gray-400">→</span>
        <input
            type="text"
            value={vendorValue}
            onChange={e => onChange(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="三方对应值"
        />
        <button type="button" onClick={onRemove}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
            <X size={14}/>
        </button>
    </div>
);

// 固定参数行组件
const FixedParamRow: React.FC<{
    paramName: string;
    paramValue: string;
    onNameChange: (value: string) => void;
    onValueChange: (value: string) => void;
    onRemove: () => void;
}> = ({paramName, paramValue, onNameChange, onValueChange, onRemove}) => (
    <div className="flex items-center gap-2 mb-2">
        <input
            type="text"
            value={paramName}
            onChange={e => onNameChange(e.target.value)}
            className="w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="参数名"
        />
        <span className="text-gray-400">=</span>
        <input
            type="text"
            value={paramValue}
            onChange={e => onValueChange(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="固定值"
        />
        <button type="button" onClick={onRemove}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
            <X size={14}/>
        </button>
    </div>
);

// 能力编辑弹窗
const CAPABILITY_TYPES = [
    {value: 'image', label: '图片'},
    {value: 'video', label: '视频'},
    {value: 'chat', label: '对话'},
    {value: 'other', label: '其他'},
];

const CapabilityModal: React.FC<{
    isOpen: boolean;
    capability: Capability | null;
    onClose: () => void;
    onSave: () => void;
}> = ({isOpen, capability, onClose, onSave}) => {
    const [form, setForm] = useState({
        code: '',
        name: '',
        type: 'image',
        description: '',
        status: 1,
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (capability) {
            setForm({
                code: capability.code,
                name: capability.name,
                type: capability.type || 'image',
                description: capability.description || '',
                status: capability.status,
            });
        } else {
            setForm({code: '', name: '', type: 'image', description: '', status: 1});
        }
    }, [capability, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (capability) {
                await updateCapability(capability.code, {
                    name: form.name,
                    type: form.type,
                    description: form.description,
                    status: form.status,
                });
            } else {
                await createCapability({
                    code: form.code,
                    name: form.name,
                    type: form.type,
                    description: form.description,
                });
            }
            onSave();
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">{capability ? '编辑能力' : '新建能力'}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20}/></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">能力编码 <span
                            className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={form.code}
                            onChange={e => setForm({...form, code: e.target.value})}
                            disabled={!!capability}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
                            placeholder="如: text2img, img2video"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">唯一标识，创建后不可修改</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">能力名称 <span
                            className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={e => setForm({...form, name: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="如: 文生图, 图生视频"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">能力类型 <span
                            className="text-red-500">*</span></label>
                        <select
                            value={form.type}
                            onChange={e => setForm({...form, type: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            {CAPABILITY_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                        <textarea
                            value={form.description}
                            onChange={e => setForm({...form, description: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="能力的详细描述..."
                            rows={3}
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose}
                                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">取消
                        </button>
                        <button type="submit" disabled={loading}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                            {loading ? '保存中...' : '保存'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// 映射配置类型
interface FieldMapping {
    stdField: string;
    vendorField: string
}

interface ValueMapping {
    field: string;
    stdValue: string;
    vendorValue: string
}

interface FixedParam {
    name: string;
    value: string
}

interface TypeConvert {
    field: string;
    type: 'string_to_array' | 'array_to_string';
    separator: string;
}

// 解析 JSON 映射为表单数据
const parseParamMapping = (mapping: Record<string, any>) => {
    const fieldMappings: FieldMapping[] = [];
    const valueMappings: ValueMapping[] = [];
    const fixedParams: FixedParam[] = [];
    const typeConverts: TypeConvert[] = [];

    if (mapping.field_mapping) {
        Object.entries(mapping.field_mapping).forEach(([std, vendor]) => {
            fieldMappings.push({stdField: std, vendorField: vendor as string});
        });
    }
    if (mapping.value_mapping) {
        Object.entries(mapping.value_mapping).forEach(([field, values]) => {
            Object.entries(values as Record<string, string>).forEach(([stdVal, vendorVal]) => {
                valueMappings.push({field, stdValue: stdVal, vendorValue: vendorVal});
            });
        });
    }
    if (mapping.fixed_params) {
        Object.entries(mapping.fixed_params).forEach(([name, value]) => {
            fixedParams.push({name, value: String(value)});
        });
    }
    if (mapping.type_convert) {
        Object.entries(mapping.type_convert).forEach(([field, config]) => {
            const c = config as { type: string; separator: string };
            typeConverts.push({
                field,
                type: c.type as 'string_to_array' | 'array_to_string',
                separator: c.separator || ','
            });
        });
    }

    return {fieldMappings, valueMappings, fixedParams, typeConverts};
};

const parseResponseMapping = (mapping: Record<string, any>) => {
    const fieldMappings: FieldMapping[] = [];
    const valueMappings: ValueMapping[] = [];
    const typeConverts: TypeConvert[] = [];

    if (mapping.field_mapping) {
        Object.entries(mapping.field_mapping).forEach(([std, vendor]) => {
            fieldMappings.push({stdField: std, vendorField: vendor as string});
        });
    }
    if (mapping.value_mapping) {
        Object.entries(mapping.value_mapping).forEach(([field, values]) => {
            Object.entries(values as Record<string, string>).forEach(([vendorVal, stdVal]) => {
                valueMappings.push({field, stdValue: stdVal, vendorValue: vendorVal});
            });
        });
    }
    if (mapping.type_convert) {
        Object.entries(mapping.type_convert).forEach(([field, config]) => {
            const c = config as { type: string; separator: string };
            typeConverts.push({
                field,
                type: c.type as 'string_to_array' | 'array_to_string',
                separator: c.separator || ','
            });
        });
    }

    return {fieldMappings, valueMappings, typeConverts};
};

// 构建 JSON 映射
const buildParamMapping = (fieldMappings: FieldMapping[], valueMappings: ValueMapping[], fixedParams: FixedParam[], typeConverts: TypeConvert[] = []) => {
    const result: Record<string, any> = {};

    const fieldMap: Record<string, string> = {};
    fieldMappings.forEach(m => {
        if (m.stdField && m.vendorField) fieldMap[m.stdField] = m.vendorField;
    });
    if (Object.keys(fieldMap).length > 0) result.field_mapping = fieldMap;

    const valueMap: Record<string, Record<string, string>> = {};
    valueMappings.forEach(m => {
        if (m.field && m.stdValue && m.vendorValue) {
            if (!valueMap[m.field]) valueMap[m.field] = {};
            valueMap[m.field][m.stdValue] = m.vendorValue;
        }
    });
    if (Object.keys(valueMap).length > 0) result.value_mapping = valueMap;

    // 类型转换
    const typeConvertMap: Record<string, { type: string; separator: string }> = {};
    typeConverts.forEach(tc => {
        if (tc.field && tc.type) {
            typeConvertMap[tc.field] = {type: tc.type, separator: tc.separator || ','};
        }
    });
    if (Object.keys(typeConvertMap).length > 0) result.type_convert = typeConvertMap;

    const fixed: Record<string, any> = {};
    fixedParams.forEach(p => {
        if (p.name && p.value) {
            // 尝试解析为数字或布尔值
            if (p.value === 'true') fixed[p.name] = true;
            else if (p.value === 'false') fixed[p.name] = false;
            else if (!isNaN(Number(p.value))) fixed[p.name] = Number(p.value);
            else fixed[p.name] = p.value;
        }
    });
    if (Object.keys(fixed).length > 0) result.fixed_params = fixed;

    return result;
};

const buildResponseMapping = (fieldMappings: FieldMapping[], valueMappings: ValueMapping[], typeConverts: TypeConvert[] = []) => {
    const result: Record<string, any> = {};

    const fieldMap: Record<string, string> = {};
    fieldMappings.forEach(m => {
        if (m.stdField && m.vendorField) fieldMap[m.stdField] = m.vendorField;
    });
    if (Object.keys(fieldMap).length > 0) result.field_mapping = fieldMap;

    // 响应映射的 value_mapping 是 { 三方值: 标准值 }
    const valueMap: Record<string, Record<string, string>> = {};
    valueMappings.forEach(m => {
        if (m.field && m.stdValue && m.vendorValue) {
            if (!valueMap[m.field]) valueMap[m.field] = {};
            valueMap[m.field][m.vendorValue] = m.stdValue;
        }
    });
    if (Object.keys(valueMap).length > 0) result.value_mapping = valueMap;

    // 类型转换
    const typeConvertMap: Record<string, { type: string; separator: string }> = {};
    typeConverts.forEach(tc => {
        if (tc.field && tc.type) {
            typeConvertMap[tc.field] = {type: tc.type, separator: tc.separator || ','};
        }
    });
    if (Object.keys(typeConvertMap).length > 0) result.type_convert = typeConvertMap;

    return result;
};

// 渠道能力配置编辑弹窗
const ChannelCapabilityModal: React.FC<{
    isOpen: boolean;
    capabilityCode: string;
    channelCapability: ChannelCapability | null;
    channels: Channel[];
    onClose: () => void;
    onSave: () => void;
}> = ({isOpen, capabilityCode, channelCapability, channels, onClose, onSave}) => {
    const [activeTab, setActiveTab] = useState<'basic' | 'request' | 'param' | 'response' | 'poll_response' | 'callback'>('basic');
    const [form, setForm] = useState({
        channel_id: 0,
        capability_code: '',
        model: '',
        name: '',
        price: 0,
        price_unit: 'request',
        result_mode: 'poll',
        request_path: '',
        request_method: 'POST',
        content_type: 'application/json',
        auth_location: 'header',
        auth_key: 'Authorization',
        auth_value_prefix: 'Bearer ',
        poll_path: '',
        poll_method: 'GET',
        poll_interval: 5,
        poll_max_attempts: 60,
    });

    // 参数映射表单状态
    const [paramFieldMappings, setParamFieldMappings] = useState<FieldMapping[]>([]);
    const [paramValueMappings, setParamValueMappings] = useState<ValueMapping[]>([]);
    const [paramFixedParams, setParamFixedParams] = useState<FixedParam[]>([]);
    const [paramTypeConverts, setParamTypeConverts] = useState<TypeConvert[]>([]);

    // 响应映射表单状态
    const [respFieldMappings, setRespFieldMappings] = useState<FieldMapping[]>([]);
    const [respValueMappings, setRespValueMappings] = useState<ValueMapping[]>([]);
    const [respTypeConverts, setRespTypeConverts] = useState<TypeConvert[]>([]);

    // 轮询响应映射表单状态
    const [pollRespFieldMappings, setPollRespFieldMappings] = useState<FieldMapping[]>([]);
    const [pollRespValueMappings, setPollRespValueMappings] = useState<ValueMapping[]>([]);
    const [pollRespTypeConverts, setPollRespTypeConverts] = useState<TypeConvert[]>([]);
    const [useSeparatePollMapping, setUseSeparatePollMapping] = useState(false);

    // 轮询参数映射表单状态（POST请求时使用）
    const [pollParamFieldMappings, setPollParamFieldMappings] = useState<FieldMapping[]>([]);
    const [pollParamFixedParams, setPollParamFixedParams] = useState<FixedParam[]>([]);

    // 回调映射
    const [callbackConfig, setCallbackConfig] = useState({
        task_id_path: '',
        status_path: '',
        result_path: '',
    });
    const [callbackStatusMappings, setCallbackStatusMappings] = useState<{
        stdValue: string;
        vendorValue: string
    }[]>([]);

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (channelCapability) {
            setForm({
                channel_id: Number(channelCapability.channelId),
                capability_code: channelCapability.capabilityCode,
                model: channelCapability.model || '',
                name: channelCapability.name || '',
                price: channelCapability.price || 0,
                price_unit: channelCapability.priceUnit || 'request',
                result_mode: channelCapability.resultMode || 'poll',
                request_path: channelCapability.requestPath || '',
                request_method: channelCapability.requestMethod || 'POST',
                content_type: channelCapability.contentType || 'application/json',
                auth_location: channelCapability.authLocation || 'header',
                auth_key: channelCapability.authKey || 'Authorization',
                auth_value_prefix: channelCapability.authValuePrefix ?? '',
                poll_path: channelCapability.pollPath || '',
                poll_method: channelCapability.pollMethod || 'GET',
                poll_interval: channelCapability.pollInterval || 5,
                poll_max_attempts: channelCapability.pollMaxAttempts || 60,
            });

            // 解析参数映射
            const paramData = parseParamMapping(channelCapability.paramMapping || {});
            setParamFieldMappings(paramData.fieldMappings);
            setParamValueMappings(paramData.valueMappings);
            setParamFixedParams(paramData.fixedParams);
            setParamTypeConverts(paramData.typeConverts);

            // 解析响应映射
            const respData = parseResponseMapping(channelCapability.responseMapping || {});
            setRespFieldMappings(respData.fieldMappings);
            setRespValueMappings(respData.valueMappings);
            setRespTypeConverts(respData.typeConverts);

            // 解析轮询响应映射
            const pollRespMapping = channelCapability.pollResponseMapping || {};
            if (Object.keys(pollRespMapping).length > 0) {
                setUseSeparatePollMapping(true);
                const pollRespData = parseResponseMapping(pollRespMapping);
                setPollRespFieldMappings(pollRespData.fieldMappings);
                setPollRespValueMappings(pollRespData.valueMappings);
                setPollRespTypeConverts(pollRespData.typeConverts);
            } else {
                setUseSeparatePollMapping(false);
                setPollRespFieldMappings([]);
                setPollRespValueMappings([]);
                setPollRespTypeConverts([]);
            }

            // 解析轮询参数映射
            const pollParamMapping = channelCapability.pollParamMapping || {};
            if (Object.keys(pollParamMapping).length > 0) {
                const pollParamData = parseParamMapping(pollParamMapping);
                setPollParamFieldMappings(pollParamData.fieldMappings);
                setPollParamFixedParams(pollParamData.fixedParams);
            } else {
                setPollParamFieldMappings([]);
                setPollParamFixedParams([]);
            }

            // 解析回调映射
            const cbMapping = channelCapability.callbackMapping || {};
            setCallbackConfig({
                task_id_path: cbMapping.task_id_path || '',
                status_path: cbMapping.status_path || '',
                result_path: cbMapping.result_path || '',
            });
            const cbStatusMappings: { stdValue: string; vendorValue: string }[] = [];
            if (cbMapping.status_mapping) {
                Object.entries(cbMapping.status_mapping).forEach(([vendor, std]) => {
                    cbStatusMappings.push({stdValue: std as string, vendorValue: vendor});
                });
            }
            setCallbackStatusMappings(cbStatusMappings);
        } else {
            setForm({
                channel_id: channels[0]?.id ? Number(channels[0].id) : 0,
                capability_code: capabilityCode,
                model: '',
                name: '',
                price: 0,
                price_unit: 'request',
                result_mode: 'poll',
                request_path: '',
                request_method: 'POST',
                content_type: 'application/json',
                auth_location: 'header',
                auth_key: 'Authorization',
                auth_value_prefix: 'Bearer ',
                poll_path: '',
                poll_method: 'GET',
                poll_interval: 5,
                poll_max_attempts: 60,
            });
            setParamFieldMappings([]);
            setParamValueMappings([]);
            setParamFixedParams([]);
            setParamTypeConverts([]);
            setRespFieldMappings([]);
            setRespValueMappings([]);
            setRespTypeConverts([]);
            setPollRespFieldMappings([]);
            setPollRespValueMappings([]);
            setPollRespTypeConverts([]);
            setUseSeparatePollMapping(false);
            setPollParamFieldMappings([]);
            setPollParamFixedParams([]);
            setCallbackConfig({task_id_path: '', status_path: '', result_path: ''});
            setCallbackStatusMappings([]);
        }
        setActiveTab('basic');
    }, [channelCapability, capabilityCode, channels, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const paramMapping = buildParamMapping(paramFieldMappings, paramValueMappings, paramFixedParams, paramTypeConverts);
            const responseMapping = buildResponseMapping(respFieldMappings, respValueMappings, respTypeConverts);

            // 轮询响应映射（如果启用单独配置）
            const pollResponseMapping = useSeparatePollMapping
                ? buildResponseMapping(pollRespFieldMappings, pollRespValueMappings, pollRespTypeConverts)
                : null;

            const callbackMapping: Record<string, any> = {};
            if (callbackConfig.task_id_path) callbackMapping.task_id_path = callbackConfig.task_id_path;
            if (callbackConfig.status_path) callbackMapping.status_path = callbackConfig.status_path;
            if (callbackConfig.result_path) callbackMapping.result_path = callbackConfig.result_path;
            if (callbackStatusMappings.length > 0) {
                const statusMap: Record<string, string> = {};
                callbackStatusMappings.forEach(m => {
                    if (m.vendorValue && m.stdValue) statusMap[m.vendorValue] = m.stdValue;
                });
                if (Object.keys(statusMap).length > 0) callbackMapping.status_mapping = statusMap;
            }

            const data: Record<string, any> = {
                channel_id: form.channel_id,
                capability_code: form.capability_code,
                model: form.model,
                name: form.name,
                price: form.price,
                price_unit: form.price_unit,
                result_mode: form.result_mode,
                request_path: form.request_path,
                request_method: form.request_method,
                content_type: form.content_type,
                auth_location: form.auth_location,
                auth_key: form.auth_key,
                auth_value_prefix: form.auth_value_prefix,
                poll_path: form.poll_path,
                poll_method: form.poll_method,
                poll_interval: form.poll_interval,
                poll_max_attempts: form.poll_max_attempts,
                param_mapping: paramMapping,
                response_mapping: responseMapping,
                callback_mapping: callbackMapping,
            };

            // 轮询响应映射
            data.poll_response_mapping = pollResponseMapping || {};

            // 轮询参数映射
            if (form.result_mode === 'poll' && form.poll_method === 'POST') {
                data.poll_param_mapping = buildParamMapping(pollParamFieldMappings, [], pollParamFixedParams, []);
            } else {
                data.poll_param_mapping = {};
            }

            if (channelCapability) {
                await updateChannelCapability(channelCapability.id, data);
            } else {
                await createChannelCapability(data);
            }
            onSave();
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const baseTabs = [
        {key: 'basic', label: '基本信息'},
        {key: 'request', label: '请求配置'},
        {key: 'param', label: '参数映射'},
        {key: 'response', label: '响应映射'},
    ];
    const tabs = useSeparatePollMapping && form.result_mode === 'poll'
        ? [...baseTabs, {key: 'poll_response', label: '轮询响应'}, {key: 'callback', label: '回调映射'}]
        : [...baseTabs, {key: 'callback', label: '回调映射'}];

    // 添加参数字段映射
    const addParamFieldMapping = (stdField: string) => {
        if (!paramFieldMappings.find(m => m.stdField === stdField)) {
            setParamFieldMappings([...paramFieldMappings, {stdField, vendorField: ''}]);
        }
    };

    // 添加响应字段映射
    const addRespFieldMapping = (stdField: string) => {
        if (!respFieldMappings.find(m => m.stdField === stdField)) {
            setRespFieldMappings([...respFieldMappings, {stdField, vendorField: ''}]);
        }
    };

    // 添加轮询响应字段映射
    const addPollRespFieldMapping = (stdField: string) => {
        if (!pollRespFieldMappings.find(m => m.stdField === stdField)) {
            setPollRespFieldMappings([...pollRespFieldMappings, {stdField, vendorField: ''}]);
        }
    };

    // 添加轮询参数字段映射（POST请求时）
    const addPollParamFieldMapping = (stdField: string) => {
        if (!pollParamFieldMappings.find(m => m.stdField === stdField)) {
            setPollParamFieldMappings([...pollParamFieldMappings, {stdField, vendorField: ''}]);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div
                className="bg-white rounded-2xl w-full max-w-3xl p-6 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">{channelCapability ? '编辑渠道能力配置' : '新建渠道能力配置'}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20}/></button>
                </div>

                <div className="flex border-b border-gray-200 mb-4 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                                activeTab === tab.key
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    {/* 基本信息 */}
                    {activeTab === 'basic' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">渠道 <span
                                        className="text-red-500">*</span></label>
                                    <select
                                        value={form.channel_id}
                                        onChange={e => setForm({...form, channel_id: Number(e.target.value)})}
                                        disabled={!!channelCapability}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
                                        required
                                    >
                                        <option value={0}>选择渠道</option>
                                        {channels.map(ch => (
                                            <option key={ch.id} value={ch.id}>{ch.name} ({ch.type})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">能力编码</label>
                                    <input type="text" value={form.capability_code} disabled
                                           className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50"/>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">配置名称</label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={e => setForm({...form, name: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="如: Midjourney文生图"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">模型标识</label>
                                    <input
                                        type="text"
                                        value={form.model}
                                        onChange={e => setForm({...form, model: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="如: midjourney-v6"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">结果模式</label>
                                    <select
                                        value={form.result_mode}
                                        onChange={e => setForm({...form, result_mode: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        {RESULT_MODES.map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">单价</label>
                                    <input
                                        type="number"
                                        value={form.price}
                                        onChange={e => setForm({...form, price: Number(e.target.value)})}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        step="0.0001"
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">计价单位</label>
                                    <select
                                        value={form.price_unit}
                                        onChange={e => setForm({...form, price_unit: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="request">按请求</option>
                                        <option value="second">按秒</option>
                                        <option value="image">按图片</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 请求配置 */}
                    {activeTab === 'request' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">请求路径 <span
                                    className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={form.request_path}
                                    onChange={e => setForm({...form, request_path: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="/api/v1/images/generate"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">请求方法</label>
                                    <select
                                        value={form.request_method}
                                        onChange={e => setForm({...form, request_method: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="POST">POST</option>
                                        <option value="GET">GET</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Content-Type</label>
                                    <select
                                        value={form.content_type}
                                        onChange={e => setForm({...form, content_type: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="application/json">application/json</option>
                                        <option
                                            value="application/x-www-form-urlencoded">application/x-www-form-urlencoded
                                        </option>
                                        <option value="multipart/form-data">multipart/form-data</option>
                                    </select>
                                </div>
                            </div>

                            {/* 认证配置 */}
                            <div className="border-t border-gray-200 pt-4 mt-4">
                                <h4 className="text-sm font-medium text-gray-900 mb-3">认证配置</h4>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">认证位置</label>
                                    <select
                                        value={form.auth_location}
                                        onChange={e => setForm({...form, auth_location: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="header">请求头 (Header)</option>
                                        <option value="body">请求体 (Body)</option>
                                        <option value="query">URL参数 (Query)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">参数名</label>
                                    <input
                                        type="text"
                                        value={form.auth_key}
                                        onChange={e => setForm({...form, auth_key: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Authorization"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">值前缀</label>
                                    <input
                                        type="text"
                                        value={form.auth_value_prefix}
                                        onChange={e => setForm({...form, auth_value_prefix: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Bearer "
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-gray-500">认证值 = 前缀 + API Key，如: Bearer sk-xxx</p>

                            {form.result_mode === 'poll' && (
                                <>
                                    <div className="border-t border-gray-200 pt-4 mt-4">
                                        <h4 className="text-sm font-medium text-gray-900 mb-3">轮询配置</h4>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label
                                                className="block text-sm font-medium text-gray-700 mb-1">轮询路径</label>
                                            <input
                                                type="text"
                                                value={form.poll_path}
                                                onChange={e => setForm({...form, poll_path: e.target.value})}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="/api/v1/tasks/{task_id}"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">支持 {'{task_id}'} 占位符</p>
                                        </div>
                                        <div>
                                            <label
                                                className="block text-sm font-medium text-gray-700 mb-1">轮询方法</label>
                                            <select
                                                value={form.poll_method}
                                                onChange={e => setForm({...form, poll_method: e.target.value})}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="GET">GET</option>
                                                <option value="POST">POST</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">轮询间隔
                                                (秒)</label>
                                            <input
                                                type="number"
                                                value={form.poll_interval}
                                                onChange={e => setForm({
                                                    ...form,
                                                    poll_interval: Number(e.target.value)
                                                })}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                min={1}
                                                max={60}
                                            />
                                        </div>
                                        <div>
                                            <label
                                                className="block text-sm font-medium text-gray-700 mb-1">最大轮询次数</label>
                                            <input
                                                type="number"
                                                value={form.poll_max_attempts}
                                                onChange={e => setForm({
                                                    ...form,
                                                    poll_max_attempts: Number(e.target.value)
                                                })}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                min={1}
                                                max={1000}
                                            />
                                        </div>
                                    </div>
                                    {form.poll_method === 'POST' && (
                                        <div className="border-t border-gray-200 pt-4 mt-4">
                                            <h4 className="text-sm font-medium text-gray-900 mb-3">轮询请求参数</h4>
                                            <p className="text-xs text-gray-500 mb-3">配置 POST 轮询请求的参数映射</p>
                                            <div className="mb-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm text-gray-700">字段映射</span>
                                                    <select
                                                        onChange={e => {
                                                            if (e.target.value) addPollParamFieldMapping(e.target.value);
                                                            e.target.value = '';
                                                        }}
                                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                    >
                                                        <option value="">+ 添加字段</option>
                                                        {Object.entries(POLL_PARAMS).filter(([key]) => !pollParamFieldMappings.find(m => m.stdField === key)).map(([key, def]) => (
                                                            <option key={key} value={key}>{def.name} ({key})</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                {pollParamFieldMappings.length === 0 ? (
                                                    <div
                                                        className="text-sm text-gray-400 text-center py-3 bg-gray-50 rounded-lg">暂无字段映射</div>
                                                ) : (
                                                    pollParamFieldMappings.map((m, i) => (
                                                        <FieldMappingRow
                                                            key={m.stdField}
                                                            stdField={m.stdField}
                                                            stdName={POLL_PARAMS[m.stdField]?.name || m.stdField}
                                                            vendorField={m.vendorField}
                                                            onChange={val => {
                                                                const newList = [...pollParamFieldMappings];
                                                                newList[i].vendorField = val;
                                                                setPollParamFieldMappings(newList);
                                                            }}
                                                            onRemove={() => setPollParamFieldMappings(pollParamFieldMappings.filter((_, idx) => idx !== i))}
                                                        />
                                                    ))
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm text-gray-700">固定参数</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setPollParamFixedParams([...pollParamFixedParams, {
                                                            name: '',
                                                            value: ''
                                                        }])}
                                                        className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                                    >
                                                        + 添加参数
                                                    </button>
                                                </div>
                                                {pollParamFixedParams.length === 0 ? (
                                                    <div
                                                        className="text-sm text-gray-400 text-center py-3 bg-gray-50 rounded-lg">暂无固定参数</div>
                                                ) : (
                                                    pollParamFixedParams.map((p, i) => (
                                                        <div key={i} className="flex items-center gap-2 mb-2">
                                                            <input
                                                                type="text"
                                                                value={p.name}
                                                                onChange={e => {
                                                                    const newList = [...pollParamFixedParams];
                                                                    newList[i].name = e.target.value;
                                                                    setPollParamFixedParams(newList);
                                                                }}
                                                                placeholder="参数名"
                                                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                            />
                                                            <span className="text-gray-400">=</span>
                                                            <input
                                                                type="text"
                                                                value={p.value}
                                                                onChange={e => {
                                                                    const newList = [...pollParamFixedParams];
                                                                    newList[i].value = e.target.value;
                                                                    setPollParamFixedParams(newList);
                                                                }}
                                                                placeholder="参数值，支持 {task_id} 占位符"
                                                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setPollParamFixedParams(pollParamFixedParams.filter((_, idx) => idx !== i))}
                                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                                            >
                                                                <Trash2 size={16}/>
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 mt-4">
                                        <input
                                            type="checkbox"
                                            id="useSeparatePollMapping"
                                            checked={useSeparatePollMapping}
                                            onChange={e => setUseSeparatePollMapping(e.target.checked)}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <label htmlFor="useSeparatePollMapping" className="text-sm text-gray-700">
                                            使用独立的轮询响应映射（提交响应与轮询响应格式不同时启用）
                                        </label>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* 参数映射 */}
                    {activeTab === 'param' && (
                        <div className="space-y-6">
                            {/* 字段映射 */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-medium text-gray-900">字段映射</h4>
                                    <select
                                        onChange={e => {
                                            if (e.target.value) addParamFieldMapping(e.target.value);
                                            e.target.value = '';
                                        }}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">+ 添加字段</option>
                                        {Object.entries(STANDARD_PARAMS).filter(([key]) => !paramFieldMappings.find(m => m.stdField === key)).map(([key, def]) => (
                                            <option key={key} value={key}>{def.name} ({key})</option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-xs text-gray-500 mb-3">配置系统标准参数到三方接口参数的字段名对应关系</p>
                                {paramFieldMappings.length === 0 ? (
                                    <div
                                        className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">暂无字段映射，请从上方添加</div>
                                ) : (
                                    paramFieldMappings.map((m, i) => (
                                        <FieldMappingRow
                                            key={m.stdField}
                                            stdField={m.stdField}
                                            stdName={STANDARD_PARAMS[m.stdField]?.name || m.stdField}
                                            vendorField={m.vendorField}
                                            onChange={val => {
                                                const newList = [...paramFieldMappings];
                                                newList[i].vendorField = val;
                                                setParamFieldMappings(newList);
                                            }}
                                            onRemove={() => setParamFieldMappings(paramFieldMappings.filter((_, idx) => idx !== i))}
                                        />
                                    ))
                                )}
                            </div>

                            {/* 枚举值映射 */}
                            <div className="border-t border-gray-200 pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-medium text-gray-900">枚举值映射</h4>
                                    <button
                                        type="button"
                                        onClick={() => setParamValueMappings([...paramValueMappings, {
                                            field: '',
                                            stdValue: '',
                                            vendorValue: ''
                                        }])}
                                        className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                    >
                                        + 添加映射
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mb-3">配置枚举类型字段的值对应关系（如 aspect_ratio:
                                    "16:9" → "landscape"）</p>
                                {paramValueMappings.length === 0 ? (
                                    <div
                                        className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">暂无枚举值映射</div>
                                ) : (
                                    paramValueMappings.map((m, i) => (
                                        <div key={i} className="flex items-center gap-2 mb-2">
                                            <select
                                                value={m.field}
                                                onChange={e => {
                                                    const newList = [...paramValueMappings];
                                                    newList[i].field = e.target.value;
                                                    newList[i].stdValue = '';
                                                    setParamValueMappings(newList);
                                                }}
                                                className="w-32 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="">选择字段</option>
                                                {Object.entries(STANDARD_PARAMS).filter(([, def]) => def.type === 'enum').map(([key, def]) => (
                                                    <option key={key} value={key}>{def.name}</option>
                                                ))}
                                            </select>
                                            <select
                                                value={m.stdValue}
                                                onChange={e => {
                                                    const newList = [...paramValueMappings];
                                                    newList[i].stdValue = e.target.value;
                                                    setParamValueMappings(newList);
                                                }}
                                                className="w-28 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                disabled={!m.field}
                                            >
                                                <option value="">系统值</option>
                                                {m.field && STANDARD_PARAMS[m.field]?.enumValues?.map(v => (
                                                    <option key={v} value={v}>{v}</option>
                                                ))}
                                            </select>
                                            <span className="text-gray-400">→</span>
                                            <input
                                                type="text"
                                                value={m.vendorValue}
                                                onChange={e => {
                                                    const newList = [...paramValueMappings];
                                                    newList[i].vendorValue = e.target.value;
                                                    setParamValueMappings(newList);
                                                }}
                                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="三方对应值"
                                            />
                                            <button type="button"
                                                    onClick={() => setParamValueMappings(paramValueMappings.filter((_, idx) => idx !== i))}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                                <X size={14}/>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* 固定参数 */}
                            <div className="border-t border-gray-200 pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-medium text-gray-900">固定参数</h4>
                                    <button
                                        type="button"
                                        onClick={() => setParamFixedParams([...paramFixedParams, {
                                            name: '',
                                            value: ''
                                        }])}
                                        className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                    >
                                        + 添加参数
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mb-3">每次请求都会附带的固定参数</p>
                                {paramFixedParams.length === 0 ? (
                                    <div
                                        className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">暂无固定参数</div>
                                ) : (
                                    paramFixedParams.map((p, i) => (
                                        <FixedParamRow
                                            key={i}
                                            paramName={p.name}
                                            paramValue={p.value}
                                            onNameChange={val => {
                                                const newList = [...paramFixedParams];
                                                newList[i].name = val;
                                                setParamFixedParams(newList);
                                            }}
                                            onValueChange={val => {
                                                const newList = [...paramFixedParams];
                                                newList[i].value = val;
                                                setParamFixedParams(newList);
                                            }}
                                            onRemove={() => setParamFixedParams(paramFixedParams.filter((_, idx) => idx !== i))}
                                        />
                                    ))
                                )}
                            </div>

                            {/* 类型转换 */}
                            <div className="border-t border-gray-200 pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-medium text-gray-900">类型转换</h4>
                                    <button
                                        type="button"
                                        onClick={() => setParamTypeConverts([...paramTypeConverts, {
                                            field: '',
                                            type: 'array_to_string',
                                            separator: ','
                                        }])}
                                        className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                    >
                                        + 添加转换
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mb-3">配置参数类型转换（如将数组转为逗号分隔的字符串）</p>
                                {paramTypeConverts.length === 0 ? (
                                    <div
                                        className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">暂无类型转换</div>
                                ) : (
                                    paramTypeConverts.map((tc, i) => (
                                        <div key={i} className="flex items-center gap-2 mb-2">
                                            <select
                                                value={tc.field}
                                                onChange={e => {
                                                    const newList = [...paramTypeConverts];
                                                    newList[i].field = e.target.value;
                                                    setParamTypeConverts(newList);
                                                }}
                                                className="w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="">选择字段</option>
                                                {paramFieldMappings.map(m => (
                                                    <option key={m.stdField} value={m.stdField}>
                                                        {STANDARD_PARAMS[m.stdField]?.name || m.stdField}
                                                    </option>
                                                ))}
                                            </select>
                                            <select
                                                value={tc.type}
                                                onChange={e => {
                                                    const newList = [...paramTypeConverts];
                                                    newList[i].type = e.target.value as 'string_to_array' | 'array_to_string';
                                                    setParamTypeConverts(newList);
                                                }}
                                                className="w-44 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="array_to_string">数组→字符串</option>
                                                <option value="string_to_array">字符串→数组</option>
                                            </select>
                                            <input
                                                type="text"
                                                value={tc.separator}
                                                onChange={e => {
                                                    const newList = [...paramTypeConverts];
                                                    newList[i].separator = e.target.value;
                                                    setParamTypeConverts(newList);
                                                }}
                                                className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="分隔符"
                                            />
                                            <span
                                                className="text-xs text-gray-400 whitespace-nowrap">用 \n 表示换行</span>
                                            <button type="button"
                                                    onClick={() => setParamTypeConverts(paramTypeConverts.filter((_, idx) => idx !== i))}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                                <X size={14}/>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* 响应映射 */}
                    {activeTab === 'response' && (
                        <div className="space-y-6">
                            {/* 字段映射 */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-medium text-gray-900">字段映射</h4>
                                    <select
                                        onChange={e => {
                                            if (e.target.value) addRespFieldMapping(e.target.value);
                                            e.target.value = '';
                                        }}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">+ 添加字段</option>
                                        {Object.entries(STANDARD_RESPONSE).filter(([key]) => !respFieldMappings.find(m => m.stdField === key)).map(([key, def]) => (
                                            <option key={key} value={key}>{def.name} ({key})</option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-xs text-gray-500 mb-3">配置三方接口响应字段路径到系统标准字段的映射（支持路径如
                                    data.output.images[0]）</p>
                                {respFieldMappings.length === 0 ? (
                                    <div
                                        className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">暂无字段映射，请从上方添加</div>
                                ) : (
                                    respFieldMappings.map((m, i) => (
                                        <div key={m.stdField} className="flex items-center gap-2 mb-2">
                                            <div className="flex-1 px-3 py-2 bg-gray-50 rounded-lg text-sm">
                                                <span
                                                    className="text-gray-600">{STANDARD_RESPONSE[m.stdField]?.name || m.stdField}</span>
                                                <code className="ml-2 text-xs text-gray-400">{m.stdField}</code>
                                            </div>
                                            <span className="text-gray-400">←</span>
                                            <input
                                                type="text"
                                                value={m.vendorField}
                                                onChange={e => {
                                                    const newList = [...respFieldMappings];
                                                    newList[i].vendorField = e.target.value;
                                                    setRespFieldMappings(newList);
                                                }}
                                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="三方响应字段路径，如 data.task_id"
                                            />
                                            <button type="button"
                                                    onClick={() => setRespFieldMappings(respFieldMappings.filter((_, idx) => idx !== i))}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                                <X size={14}/>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* 状态值映射 */}
                            <div className="border-t border-gray-200 pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-medium text-gray-900">状态值映射</h4>
                                    <button
                                        type="button"
                                        onClick={() => setRespValueMappings([...respValueMappings, {
                                            field: 'status',
                                            stdValue: '',
                                            vendorValue: ''
                                        }])}
                                        className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                    >
                                        + 添加映射
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mb-3">配置三方接口状态值到系统标准状态的映射（如
                                    "completed" → "success"）</p>
                                {respValueMappings.length === 0 ? (
                                    <div
                                        className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">暂无状态值映射</div>
                                ) : (
                                    respValueMappings.map((m, i) => (
                                        <div key={i} className="flex items-center gap-2 mb-2">
                                            <input
                                                type="text"
                                                value={m.vendorValue}
                                                onChange={e => {
                                                    const newList = [...respValueMappings];
                                                    newList[i].vendorValue = e.target.value;
                                                    setRespValueMappings(newList);
                                                }}
                                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="三方状态值，如 completed"
                                            />
                                            <span className="text-gray-400">→</span>
                                            <select
                                                value={m.stdValue}
                                                onChange={e => {
                                                    const newList = [...respValueMappings];
                                                    newList[i].stdValue = e.target.value;
                                                    setRespValueMappings(newList);
                                                }}
                                                className="w-36 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="">系统状态</option>
                                                {STANDARD_STATUS_VALUES.map(v => (
                                                    <option key={v} value={v}>{v}</option>
                                                ))}
                                            </select>
                                            <button type="button"
                                                    onClick={() => setRespValueMappings(respValueMappings.filter((_, idx) => idx !== i))}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                                <X size={14}/>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* 类型转换 */}
                            <div className="border-t border-gray-200 pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-medium text-gray-900">类型转换</h4>
                                    <button
                                        type="button"
                                        onClick={() => setRespTypeConverts([...respTypeConverts, {
                                            field: '',
                                            type: 'string_to_array',
                                            separator: ','
                                        }])}
                                        className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                    >
                                        + 添加转换
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mb-3">配置字段数据类型转换（如将逗号分隔的字符串转为数组）</p>
                                {respTypeConverts.length === 0 ? (
                                    <div
                                        className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">暂无类型转换</div>
                                ) : (
                                    respTypeConverts.map((tc, i) => (
                                        <div key={i} className="flex items-center gap-2 mb-2">
                                            <select
                                                value={tc.field}
                                                onChange={e => {
                                                    const newList = [...respTypeConverts];
                                                    newList[i].field = e.target.value;
                                                    setRespTypeConverts(newList);
                                                }}
                                                className="w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="">选择字段</option>
                                                {respFieldMappings.map(m => (
                                                    <option key={m.stdField} value={m.stdField}>
                                                        {STANDARD_RESPONSE[m.stdField]?.name || m.stdField}
                                                    </option>
                                                ))}
                                            </select>
                                            <select
                                                value={tc.type}
                                                onChange={e => {
                                                    const newList = [...respTypeConverts];
                                                    newList[i].type = e.target.value as 'string_to_array' | 'array_to_string';
                                                    setRespTypeConverts(newList);
                                                }}
                                                className="w-44 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="string_to_array">字符串→数组</option>
                                                <option value="array_to_string">数组→字符串</option>
                                            </select>
                                            <input
                                                type="text"
                                                value={tc.separator}
                                                onChange={e => {
                                                    const newList = [...respTypeConverts];
                                                    newList[i].separator = e.target.value;
                                                    setRespTypeConverts(newList);
                                                }}
                                                className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="分隔符"
                                            />
                                            <span
                                                className="text-xs text-gray-400 whitespace-nowrap">用 \n 表示换行</span>
                                            <button type="button"
                                                    onClick={() => setRespTypeConverts(respTypeConverts.filter((_, idx) => idx !== i))}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                                <X size={14}/>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* 轮询响应映射 */}
                    {activeTab === 'poll_response' && useSeparatePollMapping && (
                        <div className="space-y-6">
                            <p className="text-xs text-gray-500">配置轮询接口响应的字段映射（当轮询响应格式与提交响应不同时使用）</p>

                            {/* 字段映射 */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-medium text-gray-900">字段映射</h4>
                                    <select
                                        onChange={e => {
                                            if (e.target.value) addPollRespFieldMapping(e.target.value);
                                            e.target.value = '';
                                        }}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">+ 添加字段</option>
                                        {Object.entries(STANDARD_RESPONSE).filter(([key]) => !pollRespFieldMappings.find(m => m.stdField === key)).map(([key, def]) => (
                                            <option key={key} value={key}>{def.name} ({key})</option>
                                        ))}
                                    </select>
                                </div>
                                {pollRespFieldMappings.length === 0 ? (
                                    <div
                                        className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">暂无字段映射，请从上方添加</div>
                                ) : (
                                    pollRespFieldMappings.map((m, i) => (
                                        <div key={m.stdField} className="flex items-center gap-2 mb-2">
                                            <div className="flex-1 px-3 py-2 bg-gray-50 rounded-lg text-sm">
                                                <span
                                                    className="text-gray-600">{STANDARD_RESPONSE[m.stdField]?.name || m.stdField}</span>
                                                <code className="ml-2 text-xs text-gray-400">{m.stdField}</code>
                                            </div>
                                            <span className="text-gray-400">←</span>
                                            <input
                                                type="text"
                                                value={m.vendorField}
                                                onChange={e => {
                                                    const newList = [...pollRespFieldMappings];
                                                    newList[i].vendorField = e.target.value;
                                                    setPollRespFieldMappings(newList);
                                                }}
                                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="三方响应字段路径"
                                            />
                                            <button type="button"
                                                    onClick={() => setPollRespFieldMappings(pollRespFieldMappings.filter((_, idx) => idx !== i))}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                                <X size={14}/>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* 状态值映射 */}
                            <div className="border-t border-gray-200 pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-medium text-gray-900">状态值映射</h4>
                                    <button
                                        type="button"
                                        onClick={() => setPollRespValueMappings([...pollRespValueMappings, {
                                            field: 'status',
                                            stdValue: '',
                                            vendorValue: ''
                                        }])}
                                        className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                    >
                                        + 添加映射
                                    </button>
                                </div>
                                {pollRespValueMappings.length === 0 ? (
                                    <div
                                        className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">暂无状态值映射</div>
                                ) : (
                                    pollRespValueMappings.map((m, i) => (
                                        <div key={i} className="flex items-center gap-2 mb-2">
                                            <input
                                                type="text"
                                                value={m.vendorValue}
                                                onChange={e => {
                                                    const newList = [...pollRespValueMappings];
                                                    newList[i].vendorValue = e.target.value;
                                                    setPollRespValueMappings(newList);
                                                }}
                                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="三方状态值"
                                            />
                                            <span className="text-gray-400">→</span>
                                            <select
                                                value={m.stdValue}
                                                onChange={e => {
                                                    const newList = [...pollRespValueMappings];
                                                    newList[i].stdValue = e.target.value;
                                                    setPollRespValueMappings(newList);
                                                }}
                                                className="w-36 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="">系统状态</option>
                                                {STANDARD_STATUS_VALUES.map(v => (
                                                    <option key={v} value={v}>{v}</option>
                                                ))}
                                            </select>
                                            <button type="button"
                                                    onClick={() => setPollRespValueMappings(pollRespValueMappings.filter((_, idx) => idx !== i))}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                                <X size={14}/>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* 类型转换 */}
                            <div className="border-t border-gray-200 pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-medium text-gray-900">类型转换</h4>
                                    <button
                                        type="button"
                                        onClick={() => setPollRespTypeConverts([...pollRespTypeConverts, {
                                            field: '',
                                            type: 'string_to_array',
                                            separator: ','
                                        }])}
                                        className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                    >
                                        + 添加转换
                                    </button>
                                </div>
                                {pollRespTypeConverts.length === 0 ? (
                                    <div
                                        className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">暂无类型转换</div>
                                ) : (
                                    pollRespTypeConverts.map((tc, i) => (
                                        <div key={i} className="flex items-center gap-2 mb-2">
                                            <select
                                                value={tc.field}
                                                onChange={e => {
                                                    const newList = [...pollRespTypeConverts];
                                                    newList[i].field = e.target.value;
                                                    setPollRespTypeConverts(newList);
                                                }}
                                                className="w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="">选择字段</option>
                                                {pollRespFieldMappings.map(m => (
                                                    <option key={m.stdField}
                                                            value={m.stdField}>{STANDARD_RESPONSE[m.stdField]?.name || m.stdField}</option>
                                                ))}
                                            </select>
                                            <select
                                                value={tc.type}
                                                onChange={e => {
                                                    const newList = [...pollRespTypeConverts];
                                                    newList[i].type = e.target.value as 'string_to_array' | 'array_to_string';
                                                    setPollRespTypeConverts(newList);
                                                }}
                                                className="w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="string_to_array">字符串→数组</option>
                                                <option value="array_to_string">数组→字符串</option>
                                            </select>
                                            <input
                                                type="text"
                                                value={tc.separator}
                                                onChange={e => {
                                                    const newList = [...pollRespTypeConverts];
                                                    newList[i].separator = e.target.value;
                                                    setPollRespTypeConverts(newList);
                                                }}
                                                className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="分隔符"
                                            />
                                            <button type="button"
                                                    onClick={() => setPollRespTypeConverts(pollRespTypeConverts.filter((_, idx) => idx !== i))}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                                <X size={14}/>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* 回调映射 */}
                    {activeTab === 'callback' && (
                        <div className="space-y-6">
                            <p className="text-xs text-gray-500">仅在结果模式为"回调"时使用，配置三方回调数据的解析规则</p>

                            <div>
                                <h4 className="text-sm font-medium text-gray-900 mb-3">路径配置</h4>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <label className="w-24 text-sm text-gray-600">任务ID路径</label>
                                        <input
                                            type="text"
                                            value={callbackConfig.task_id_path}
                                            onChange={e => setCallbackConfig({
                                                ...callbackConfig,
                                                task_id_path: e.target.value
                                            })}
                                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="如 data.taskId"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="w-24 text-sm text-gray-600">状态路径</label>
                                        <input
                                            type="text"
                                            value={callbackConfig.status_path}
                                            onChange={e => setCallbackConfig({
                                                ...callbackConfig,
                                                status_path: e.target.value
                                            })}
                                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="如 data.state"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="w-24 text-sm text-gray-600">结果路径</label>
                                        <input
                                            type="text"
                                            value={callbackConfig.result_path}
                                            onChange={e => setCallbackConfig({
                                                ...callbackConfig,
                                                result_path: e.target.value
                                            })}
                                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="如 data.output"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-gray-200 pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-medium text-gray-900">状态值映射</h4>
                                    <button
                                        type="button"
                                        onClick={() => setCallbackStatusMappings([...callbackStatusMappings, {
                                            stdValue: '',
                                            vendorValue: ''
                                        }])}
                                        className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                    >
                                        + 添加映射
                                    </button>
                                </div>
                                {callbackStatusMappings.length === 0 ? (
                                    <div
                                        className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">暂无状态值映射</div>
                                ) : (
                                    callbackStatusMappings.map((m, i) => (
                                        <div key={i} className="flex items-center gap-2 mb-2">
                                            <input
                                                type="text"
                                                value={m.vendorValue}
                                                onChange={e => {
                                                    const newList = [...callbackStatusMappings];
                                                    newList[i].vendorValue = e.target.value;
                                                    setCallbackStatusMappings(newList);
                                                }}
                                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="三方状态值，如 COMPLETED"
                                            />
                                            <span className="text-gray-400">→</span>
                                            <select
                                                value={m.stdValue}
                                                onChange={e => {
                                                    const newList = [...callbackStatusMappings];
                                                    newList[i].stdValue = e.target.value;
                                                    setCallbackStatusMappings(newList);
                                                }}
                                                className="w-36 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="">系统状态</option>
                                                {STANDARD_STATUS_VALUES.map(v => (
                                                    <option key={v} value={v}>{v}</option>
                                                ))}
                                            </select>
                                            <button type="button"
                                                    onClick={() => setCallbackStatusMappings(callbackStatusMappings.filter((_, idx) => idx !== i))}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                                <X size={14}/>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 pt-6 mt-4 border-t border-gray-200">
                        <button type="button" onClick={onClose}
                                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">取消
                        </button>
                        <button type="submit" disabled={loading}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                            {loading ? '保存中...' : '保存'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const Capabilities: React.FC = () => {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [channelCapabilities, setChannelCapabilities] = useState<ChannelCapability[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCapability, setExpandedCapability] = useState<string | null>(null);

    const [capabilityModal, setCapabilityModal] = useState<{
        open: boolean;
        capability: Capability | null
    }>({open: false, capability: null});
    const [ccModal, setCcModal] = useState<{
        open: boolean;
        capabilityCode: string;
        cc: ChannelCapability | null
    }>({open: false, capabilityCode: '', cc: null});

    useEffect(() => {
        loadData();
    }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [caps, ccs, chs] = await Promise.all([
        fetchCapabilities(),
        fetchChannelCapabilities(),
        fetchChannels(),
      ]);
      setCapabilities(caps);
      setChannelCapabilities(ccs);
      setChannels(chs);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCapability = async (code: string) => {
      if (!confirm('确定删除该能力定义? 相关的渠道配置也会被删除。')) return;
    await deleteCapability(code);
    loadData();
  };

  const handleDeleteChannelCapability = async (id: string) => {
    if (!confirm('确定删除该渠道能力配置?')) return;
    await deleteChannelCapability(id);
    loadData();
  };

    const handleToggleCapabilityStatus = async (cap: Capability) => {
        await updateCapability(cap.code, {status: cap.status === 1 ? 0 : 1});
        loadData();
    };

    const handleToggleCcStatus = async (cc: ChannelCapability) => {
        await updateChannelCapability(cc.id, {status: cc.status === 1 ? 0 : 1});
        loadData();
    };

    const getChannelCapabilitiesByCode = (code: string) => channelCapabilities.filter(cc => cc.capabilityCode === code);
    const getChannelName = (channelId: string) => channels.find(c => c.id === channelId)?.name || channelId;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">能力配置</h1>
            <p className="text-gray-500 mt-1">管理平台能力定义和渠道能力映射</p>
          </div>
        </div>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 h-24"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">能力配置</h1>
          <p className="text-gray-500 mt-1">管理平台能力定义和渠道能力映射</p>
        </div>
          <div className="flex gap-2">
              <button onClick={loadData}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                  <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''}/>
                  刷新
              </button>
              <button
                  onClick={() => setCapabilityModal({open: true, capability: null})}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm"
              >
                  <Plus size={18}/>
                  新建能力
              </button>
          </div>
      </div>

      <div className="space-y-4">
        {capabilities.map(cap => {
          const isExpanded = expandedCapability === cap.code;
          const relatedCCs = getChannelCapabilitiesByCode(cap.code);

          return (
            <div key={cap.code} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div
                className="p-6 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedCapability(isExpanded ? null : cap.code)}
              >
                <div className="flex items-center gap-4">
                  {isExpanded ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Cpu size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-gray-900">{cap.name}</h3>
                      <code className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{cap.code}</code>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                            cap.type === 'image' ? 'bg-blue-50 text-blue-600' :
                                cap.type === 'video' ? 'bg-purple-50 text-purple-600' :
                                    cap.type === 'chat' ? 'bg-green-50 text-green-600' :
                                        'bg-gray-50 text-gray-600'
                        }`}>
                        {cap.type === 'image' ? '图片' : cap.type === 'video' ? '视频' : cap.type === 'chat' ? '对话' : '其他'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${cap.status === 1 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        {cap.status === 1 ? '启用' : '禁用'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{cap.description || '暂无描述'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">{relatedCCs.length} 个渠道配置</span>
                  <div className="flex gap-1">
                    <button
                        onClick={e => {
                            e.stopPropagation();
                            handleToggleCapabilityStatus(cap);
                        }}
                        className={`p-1.5 rounded-lg ${cap.status === 1 ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}
                        title={cap.status === 1 ? '禁用' : '启用'}
                    >
                        <Power size={16}/>
                    </button>
                      <button
                          onClick={e => {
                              e.stopPropagation();
                              setCapabilityModal({open: true, capability: cap});
                          }}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteCapability(cap.code); }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50/50">
                  <div className="p-4 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-700">渠道能力配置</h4>
                      <button
                          onClick={() => setCcModal({open: true, capabilityCode: cap.code, cc: null})}
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700"
                      >
                      <Plus size={14} />
                      添加渠道配置
                    </button>
                  </div>

                  {relatedCCs.length === 0 ? (
                    <div className="px-4 pb-4 text-sm text-gray-500 text-center py-8">
                      暂无渠道配置，点击上方按钮添加
                    </div>
                  ) : (
                    <div className="px-4 pb-4 space-y-2">
                      {relatedCCs.map(cc => (
                          <div key={cc.id}
                               className="bg-white p-4 rounded-xl border border-gray-200 flex items-center justify-between group">
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-gray-100 rounded-lg">
                              <Settings size={16} className="text-gray-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{cc.name || cc.model || '未命名'}</span>
                                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                                  {getChannelName(cc.channelId)}
                                </span>
                                <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded">
                                  {cc.resultMode}
                                </span>
                                  <span
                                      className={`text-xs px-2 py-0.5 rounded ${cc.status === 1 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                  {cc.status === 1 ? '启用' : '禁用'}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                  {cc.requestMethod} {cc.requestPath} | 价格: {cc.price}/{cc.priceUnit}
                              </div>
                            </div>
                          </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                      onClick={() => handleToggleCcStatus(cc)}
                                      className={`p-1.5 rounded-lg ${cc.status === 1 ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}
                                      title={cc.status === 1 ? '禁用' : '启用'}
                                  >
                                      <Power size={14}/>
                                  </button>
                                  <button
                                      onClick={() => setCcModal({open: true, capabilityCode: cap.code, cc})}
                                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                  >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteChannelCapability(cc.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {capabilities.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <Cpu size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">暂无能力定义</h3>
            <p className="text-gray-500 mb-4">点击上方按钮创建第一个能力</p>
          </div>
        )}
      </div>

        <CapabilityModal
            isOpen={capabilityModal.open}
            capability={capabilityModal.capability}
            onClose={() => setCapabilityModal({open: false, capability: null})}
            onSave={loadData}
        />
        <ChannelCapabilityModal
            isOpen={ccModal.open}
            capabilityCode={ccModal.capabilityCode}
            channelCapability={ccModal.cc}
            channels={channels}
            onClose={() => setCcModal({open: false, capabilityCode: '', cc: null})}
            onSave={loadData}
        />
    </div>
  );
};

export default Capabilities;
