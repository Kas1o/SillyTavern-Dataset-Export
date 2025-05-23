import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

const extensionName = "SillyTavern-Dataset-Export";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {};

// Loads the extension settings if they exist, otherwise initializes them to the defaults.
async function loadSettings() {
    //Create the settings if they don't exist
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
      Object.assign(extension_settings[extensionName], defaultSettings);
    }
  
    // Updating settings in the UI
    $("#insert_sysprompt_content").prop("checked", extension_settings[extensionName].insert_sysprompt_content).trigger("input");
}

function onSystemPromptSettingInput(event){
    const value = Boolean($(event.target).prop("checked"));
    extension_settings[extensionName].insert_sysprompt_content = value;
    console.log("Now insert_sysprompt_content set to:"+ extension_settings[extensionName].insert_sysprompt_content)
    saveSettingsDebounced();
}

function GetSystemPrompt(ctx){
    const username = ctx.name1;
    const charname = ctx.name2;
    let charaDesc = ctx.characters[ctx.characterId].description;

    charaDesc = charaDesc.replaceAll("{{char}}",charname);
    charaDesc = charaDesc.replaceAll("{{user}}",username);

    let systemprompt = $("#sysprompt_content").prop("value");
    systemprompt = systemprompt.replaceAll("{{char}}",charname);
    systemprompt = systemprompt.replaceAll("{{user}}",username);

    return extension_settings[extensionName].insert_sysprompt_content? systemprompt + charaDesc: charaDesc;
}

jQuery(() => {
    (async()=>{
        const settingsHTML = await $.get(`${extensionFolderPath}/settings.html`);
        $("#extensions_settings").append(settingsHTML);
        $("#insert_sysprompt_content").on("input", onSystemPromptSettingInput);

        loadSettings();
    })();

    $('<a id="option_export_dataset_sg"><i class="fa-lg fa-solid fa-table"></i><span>Export as dataset(ShareGPT)</span></a>')
        .insertAfter('#option_select_chat')
        .on('click', async () => {
            const context = window['SillyTavern'].getContext();
            const chatId = context.getCurrentChatId();
            if (!chatId) {
                toastr.info('Please select a chat first');
                return;
            }
            const chat = context.chat;
            // 初始化历史对话数组
            let history = [];
            // 获取系统描述
            let systemDescription = GetSystemPrompt(context);
            // 遍历所有聊天记录，并构造对话数组
            for (let i = 0; i < chat.length; i++) {
                const message = chat[i];
                if (message.is_system) {
                    history.push({
                        "from": "system",
                        "value": message.mes
                    });
                } else if (message.is_user) {
                    history.push({
                        "from": "human",
                        "value": message.mes
                    });
                } else {
                    history.push({
                        "from": "gpt",
                        "value": message.mes
                    });
                }
            }
            // 构造最终的输出数据
            let dataset = [{
                'conversations': history,
                'system': systemDescription
            }];
            if (!dataset.length) {
                toastr.info('No exportable data found, 没找到数据, 你可以尝试先生成一段对话来创建缓存。');
                return;
            }
            const blob = new Blob([JSON.stringify(dataset, null, 4)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${chatId}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    $('<a id="option_export_dataset_sg_pref"><i class="fa-lg fa-solid fa-table"></i><span>Export as dataset(ShareGPT pref)</span></a>')
        .insertAfter('#option_select_chat')
        .on('click', async () => {
            const context = window['SillyTavern'].getContext();
            const chatId = context.getCurrentChatId();
            if (!chatId) {
                toastr.info('Please select a chat first');
                return;
            }
            const chat = context.chat;
            // 初始化数据集
            let dataset = [];
            // 获取系统描述
            let systemDescription = GetSystemPrompt(context);
            for(let mesIdx = 0;mesIdx < chat.length; mesIdx++){
                //检测是否是ai输出且有两条swipes
                let cur_mes = chat[mesIdx]
                if(mesIdx === 0) continue; //跳过第一条消息
                if(cur_mes.is_user) continue;
                if(cur_mes.swipes.length < 2) continue; //如果小于两条则跳过
                // 初始化历史对话数组
                let history = [];

                // 遍历所有聊天记录，并构造对话数组
                for (let i = 0; i < mesIdx; i++) {
                    const message = chat[i];
                    if (message.is_system) {
                        history.push({
                            "from": "system",
                            "value": message.mes
                        });
                    } else if (message.is_user) {
                        history.push({
                            "from": "human",
                            "value": message.mes
                        });
                    } else {
                        history.push({
                            "from": "gpt",
                            "value": message.mes
                        });
                    }
                }
                dataset.push({
                    'conversations': history,
                    'system': systemDescription,
                    "chosen": {
                        "from": "gpt",
                        "value": cur_mes.mes
                      },
                      "rejected": {
                        "from": "gpt",
                        "value": cur_mes.swipes[0] == cur_mes.mes? cur_mes.swipes[1] : cur_mes.swipes[0]//如果当前选择是第一条就选第二条,否则选第一条
                      }
                })

            }
            if (!dataset.length) {
                toastr.info('No exportable data found, 没找到数据, 你可以尝试先生成一段对话来创建缓存。');
                return;
            }
            const blob = new Blob([JSON.stringify(dataset, null, 4)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${chatId}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    $('<a id="option_export_dataset_text"><i class="fa-lg fa-solid fa-table"></i><span>Export as dataset(Assistant Text Only)</span></a>')
    .insertAfter('#option_select_chat')
    .on('click', async () => {
        function downloadStringAsBlob(content, filename, mimeType = 'text/plain') {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
        
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        
        const context = window['SillyTavern'].getContext();
        const chat = context.chat;
        let history = "";
        for (let i = 0; i < chat.length; i++) {
           const message = chat[i];
           if(!(message.is_system) && !(message.is_user)){
               history += message.mes;
           }
        }
        downloadStringAsBlob(history);
    });
});
