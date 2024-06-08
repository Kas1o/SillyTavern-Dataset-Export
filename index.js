jQuery(() => {
    $('<a id="option_export_dataset"><i class="fa-lg fa-solid fa-table"></i><span>Export as dataset</span></a>')
        .insertAfter('#option_select_chat')
        .on('click', async () => {
            const context = window['SillyTavern'].getContext();
            const promptStorage = new localforage.createInstance({ name: 'SillyTavern_Prompts' });
            const chatId = context.getCurrentChatId();
            if (!chatId) {
                toastr.info('Please select a chat first');
                return;
            }
            const itemizedPrompts = (await promptStorage.getItem(chatId)) || [];
            const dataset = [];
            const chat = context.chat;
            // 寻找所有的角色输出并为其构造数据
            for (let i = 0; i < chat.length; i++) {
                const message = chat[i];
                if (message.is_user || message.is_system) continue;
                const itemizedPrompt = itemizedPrompts.find(x => x.mesId === chat.indexOf(message));
                if (!itemizedPrompt) {
                    console.warn(`No prompt found for message ${chat.indexOf(message)}`);
                    continue;
                }
                // 获取系统描述
                let system = itemizedPrompt.instruction + '\n' + itemizedPrompt.charDescription;
                // 初始化历史对话数组
                let history = [];
                // 在这里再次将所有小于 i 的 message 加入 history，如果是 is_system 则忽略
                for (let j = 0; j < i; j++) {
                    const pastMessage = chat[j];
                    if (pastMessage.is_system) continue; // 忽略系统消息
                    if (pastMessage.is_user) {
                        // 用户消息放在左边
                        history.push([pastMessage.mes, ""]);
                    } else {
                        // 助手消息放在右边
                        if (history.length > 0 && history[history.length - 1][1] === "") {
                            history[history.length - 1][1] = pastMessage.mes;
                        } else {
                            history.push(["", pastMessage.mes]);
                        }
                    }
                }
                // 将数据推入 dataset
                dataset.push({
                    'instruction': "", // 留空勿动
                    'system': system,
                    'output': message.mes,
                    'history': history
                });
            }
            if (!dataset.length) {
                toastr.info('No exportable data found');
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
});
