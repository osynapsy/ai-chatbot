class ChatUI 
{
    constructor(options = {})
    {       
        this.panelChatMessagesSelector = options.panelChatMessagesSelector || '#osy-chatbot-messages';
        //this.divThoughtSelector = options.divThoughtSelector || '#osy-chatbot-message-thought',
        //this.divContentSelector = options.divContentSelector || '#osy-chatbot-message-content',        
        this.inputSelector = options.inputSelector || 'textarea';
        this.btnInputSendSelector = options.buttonSelector || '#osy-chatbot-input-send';

        this.panelChatMessages = document.querySelector(this.panelChatMessagesSelector);
        this.inputField = document.querySelector(this.inputSelector);
        this.btnInputSend = document.querySelector(this.btnInputSendSelector);
        this.divThought = document.querySelector(this.divThoughtSelector);
        this.divContent = document.querySelector(this.divContentSelector);
        this.container     = document.querySelector('.osynapsy-ai-chatbot-container');
        this.workspacePane = document.querySelector('#osy-chatbot-workspace');
        this.attachedImages     = []; // Array di stringhe Base64 pure (senza prefisso data:image/...)
        this.imagePreviewBox    = document.querySelector(options.imagePreviewSelector || '#osy-chatbot-image-previews');
        this.hiddenImagesInput  = document.querySelector(options.hiddenImagesSelector || '#osy-chatbot-images');
        this.init();
        this.updateHeight();
    }

    init()
    {        
        
        if (!this.panelChatMessages || !this.inputField) return;        
        // Assegniamo la classe CSS strutturale al pannello
        this.panelChatMessages.classList.add('chat-output-panel');

        if (this.btnInputSend) {
            this.btnInputSend.addEventListener('click', () => this.sendMessage());
        }        
        this.panelChatMessages.scrollTo({
            top: this.panelChatMessages.scrollHeight,
            behavior: "smooth" // Rende lo scroll fluido
        });
        // Intercetta Ctrl+V / Cmd+V sulla textarea del prompt
        this.inputField.addEventListener('paste', (e) => this.handlePaste(e));
         /*
            this.inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        */
    }
    
    updateHeight()
    {
        const cbot = this.panelChatMessages.closest('.osy-chatbot');
        const rect = this.panelChatMessages.getBoundingClientRect();
        const bodyStyles = window.getComputedStyle(document.body);
        const paddingBottom = parseFloat(bodyStyles.getPropertyValue('padding-bottom')) || 0;
        const posTop = rect.top;
        cbot.style.setProperty('--chatbot-top', `${posTop}px`);
        cbot.style.setProperty('--body-padding-bottom', `${paddingBottom}px`);
    }

/**
     * Gestisce l'incolla di immagini dagli appunti (Ctrl+V)
     */
    handlePaste(e)
    {        
        const items = (e.clipboardData || window.clipboardData)?.items;
        if (!items) return;

        for (const item of items) {
                    console.log(item);
            if (item.type.startsWith('image/')) {
                e.preventDefault(); // Evita di incollare eventuale testo spazzatura
                const file = item.getAsFile();
                if (file) {
                    this.processImageFile(file);
                }
            }
        }
    }

    /**
     * Converte il File in Base64, aggiorna l'input nascosto per Osynapsy e disegna la miniatura
     */
    processImageFile(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target.result; // "data:image/png;base64,iVBORw0KGgo..."
            // Ollama vuole il Base64 puro senza intestazione MIME
            const pureBase64 = dataUrl.split(',')[1];

            this.attachedImages.push({
                dataUrl: dataUrl,
                base64: pureBase64
            });

            this.syncImagesInput();
            this.renderImagePreviews();
        };
        reader.readAsDataURL(file);
    }

    /**
     * Sincronizza l'input nascosto letto da data-action-parameters di Osynapsy
     */
    syncImagesInput() {
        if (!this.hiddenImagesInput) return;
        const onlyBase64 = this.attachedImages.map(img => img.base64);
        this.hiddenImagesInput.value = onlyBase64.length > 0 ? JSON.stringify(onlyBase64) : '';
    }
    
    /**
     * Mostra le miniature delle immagini incollate sopra la textarea con pulsante rimuovi (×)
     */
    renderImagePreviews() {
        if (!this.imagePreviewBox) return;

        if (this.attachedImages.length === 0) {
            this.imagePreviewBox.innerHTML = '';
            this.imagePreviewBox.classList.add('d-none');
            return;
        }

        this.imagePreviewBox.classList.remove('d-none');
        this.imagePreviewBox.innerHTML = this.attachedImages.map((img, idx) => `
            <div class="position-relative d-inline-block mr-2 mb-2">
                <img src="${img.dataUrl}" class="rounded border shadow-sm" style="height: 64px; width: auto; object-fit: cover;">
                <button type="button"
                        class="btn btn-danger btn-sm rounded-circle position-absolute d-flex align-items-center justify-content-center"
                        style="top: -6px; right: -6px; width: 20px; height: 20px; padding: 0; font-size: 11px;"
                        onclick="window.myAiChat.removeAttachedImage(${idx})"
                        title="Rimuovi immagine">
                    &times;
                </button>
            </div>
        `).join('');
    }

    removeAttachedImage(index) {
        this.attachedImages.splice(index, 1);
        this.syncImagesInput();
        this.renderImagePreviews();
    }   

    /**
     * Aggiorna sendMessage() per mostrare le miniature anche nella bolla utente e pulire l'allegato dopo l'invio
     */
    sendMessage(customText = null)
    {
        const text = customText || this.inputField.value.trim();
        const hasImages = this.attachedImages.length > 0;

        if (!text && !hasImages) return;

        this.finalizeStream();

        // Mostra il messaggio + eventuali miniature nella bolla dell'utente
        const imagesSnapshot = [...this.attachedImages];
        this.appendUserMessageWithImages(text, imagesSnapshot);

        if (!customText) {
            setTimeout(() => {
                //if (this.inputField) this.inputField.value = '';
                this.attachedImages = [];
                this.syncImagesInput();
                this.renderImagePreviews();
            }, 80); // Piccolo delay per dare tempo a Osynapsy di leggere #osy-chatbot-images al click
        }
    }

    appendUserMessageWithImages(text, images = [])
    {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message user-message';

        if (images.length > 0) {
            const imgWrap = document.createElement('div');
            imgWrap.className = 'mb-2 d-flex flex-wrap gap-2';
            images.forEach(img => {
                const el = document.createElement('img');
                el.src = img.dataUrl;
                el.className = 'rounded border';
                el.style.maxHeight = '160px';
                el.style.maxWidth = '100%';
                imgWrap.appendChild(el);
            });
            msgDiv.appendChild(imgWrap);
        }

        if (text) {
            const textSpan = document.createElement('div');
            textSpan.textContent = text;
            msgDiv.appendChild(textSpan);
        }

        this.panelChatMessages.appendChild(msgDiv);
        this.panelChatMessages.scrollTop = this.panelChatMessages.scrollHeight;
        return msgDiv;
    }
    

    /**
     * Metodo pubblico per aggiungere un messaggio a schermo
     */
    appendMessage(role, text)
    {
        const msgDiv = document.createElement('div');
        const typDiv = document.getElementById('osy-chatbot-typing');
        if (typDiv && !typDiv.classList.contains('d-none')) {            
            typDiv.classList.add('d-none');
            typDiv.textContent = '';
        }        
        // Mappatura pulita dei ruoli alle classi CSS
        msgDiv.className = `chat-message ${role}-message`;
        msgDiv.textContent = text;

        this.panelChatMessages.appendChild(msgDiv);
        this.panelChatMessages.scrollTop = this.panelChatMessages.scrollHeight;

        return msgDiv;
    }

    streamWrite(rawLine)
    {
        const line = rawLine.trim();
        if (!line) return;
        let msg;
        try {
            msg = JSON.parse(line);
        } catch (e) {
            console.warn('Riga dello stream non valida:', line);
            return;
        }        
        this.handleStreamMessage(msg);
    }

    handleStreamMessage(msg)
    {
        console.log(msg.type, msg.text);
        switch (msg.type) {
            case 'reasoning': this.appendThoughtContent(msg.text); break;
            case 'content':   this.appendResponseContent(msg.text); break;
            case 'status':    this.setStatus(msg.text); break;
            case 'error':     this.showError(msg.text); break;
            case 'done':      this.finalizeStream(msg); break;
        }
    }
    
    /**
     * Aggiunge o aggiorna il contenuto del blocco di pensiero (Thinking)
     */
    appendThoughtContent(text) 
    {
        // Se non esiste ancora una bolla attiva dell'assistente, la creiamo
        if (!this.currentAssistantBubble) {
            this.createAssistantBubble();
        }

        // Se il blocco di pensiero è stato nascosto o finalizzato, lo ignoriamo o lo riattiviamo
        if (this.thoughtDiv.style.display === 'none') {
            this.thoughtDiv.style.display = 'block';
        }

        // Accumula il testo nel pensiero
        this.thoughtTextAccumulator += text;
        this.thoughtDiv.querySelector('.thought-text').textContent = this.thoughtTextAccumulator;
        
        // Scroll automatico in basso
        this.panelChatMessages.scrollTop = this.panelChatMessages.scrollHeight;
    }
    
    appendResponseContent(text) 
    {
        if (!this.currentAssistantBubble) {
            this.createAssistantBubble();
        }

        // Se arrivano i primi token di risposta e il pensiero era attivo, lo chiudiamo
        if (this.isThinkingActive && this.thoughtTextAccumulator.length > 0) {
            this.isThinkingActive = false;
            
            // Trasformiamo il box del pensiero in un'etichetta cliccabile "Ragionamento completato"
            this.thoughtDiv.className = 'chat-thought-header text-muted small mb-2 p-2 bg-light border-left border-secondary rounded cursor-pointer';
            this.thoughtDiv.innerHTML = '<i class="fa fa-check text-success"></i> Ragionamento completato <small class="text-info float-right">[Mostra]</small>';
            
            // Creiamo un contenitore interno nascosto per il testo del pensiero vero e proprio
            const thoughtContentContainer = document.createElement('div');
            thoughtContentContainer.className = 'thought-collapsed-content mt-2 p-2 bg-white border rounded small d-none';
            thoughtContentContainer.innerHTML =  this.markedPurifyText(this.thoughtTextAccumulator);
            
            // Aggiungiamo il testo nascosto dentro il blocco del pensiero
            this.thoughtDiv.appendChild(thoughtContentContainer);

            // Aggiungiamo l'evento click per fare il toggle (apri/chiudi)
            this.thoughtDiv.addEventListener('click', () => {
                const isHidden = thoughtContentContainer.classList.contains('d-none');
                if (isHidden) {
                    thoughtContentContainer.classList.remove('d-none');
                    this.thoughtDiv.querySelector('.float-right').textContent = '[Nascondi]';
                } else {
                    thoughtContentContainer.classList.add('d-none');
                    this.thoughtDiv.querySelector('.float-right').textContent = '[Mostra]';
                }
            });
        }

        // 1. Accumula il testo grezzo in Markdown
        this.responseTextAccumulator += text;                                
        // 3. Usa innerHTML invece di textContent
        this.responseDiv.querySelector('.response-text').innerHTML = this.markedPurifyText(this.responseTextAccumulator);
        
        // Scroll automatico in basso
        this.panelChatMessages.scrollTop = this.panelChatMessages.scrollHeight;
    }
    
    // Converte il Markdown in HTML pulito e sicuro
    markedPurifyText(txt)
    {
        const rawHtml = marked.parse(txt);
        const cleanHtml = DOMPurify.sanitize(rawHtml);
        return cleanHtml;
    }
    
    /**
     * Viene chiamato al termine dello stream (done). 
     * Pulisce lo stato, clona o finalizza i nodi e salva il risultato definitivo.
     */
    finalizeStream(data = {}) {
        if (!this.currentAssistantBubble) return;

        // 1. Se il server ha restituito un ID chat o metadati finali, aggiorniamo la history/URL
        if (data.chat_id) {
            history.pushState(null, '', '?chat_id=' + data.chat_id);
            if (typeof updateChatSidebar === 'function') {
                updateChatSidebar(data.chat_id, data.title);
            }
        }

        // 2. Pulizia opzionale del box di pensiero se era rimasto aperto
        if (this.thoughtDiv && this.thoughtDiv.parentNode) {
            // Esempio: se vuoi che il pensiero sparisca del tutto alla fine, puoi rimuoverlo o lasciarlo compatto
            // this.thoughtDiv.remove(); 
        }

        // 3. Clonazione o congelamento del nodo definitivo (opzionale se vuoi renderlo statico)
        // const clonedBubble = this.currentAssistantBubble.cloneNode(true);
        // this.currentAssistantBubble.replaceWith(clonedBubble);

        // 4. Resettiamo le variabili di stato per la prossima interazione
        this.currentAssistantBubble = null;
        this.thoughtDiv = null;
        this.responseDiv = null;
        this.thoughtTextAccumulator = '';
        this.responseTextAccumulator = '';
        this.isThinkingActive = true;
    }

    /**
     * Metodo di supporto interno per inizializzare la struttura HTML della bolla dell'assistente
     */
    createAssistantBubble() {
        this.currentAssistantBubble = document.createElement('div');
        this.currentAssistantBubble.className = 'chat-message assistant-message p-3 mb-2 bg-white border rounded shadow-sm';

        // Contenitore del pensiero (Thinking)
        this.thoughtDiv = document.createElement('div');
        this.thoughtDiv.className = 'chat-thought-box text-muted small mb-2 p-2 bg-light border-left border-primary';
        this.thoughtDiv.innerHTML = '<i class="fa fa-cog fa-spin"></i> <span class="thought-text">Sto elaborando...</span>';

        // Contenitore della risposta finale
        this.responseDiv = document.createElement('div');
        this.responseDiv.className = 'chat-response-box';
        this.responseDiv.innerHTML = '<span class="response-text"></span>';

        this.currentAssistantBubble.appendChild(this.thoughtDiv);
        this.currentAssistantBubble.appendChild(this.responseDiv);

        this.panelChatMessages.appendChild(this.currentAssistantBubble);
        
        // Inizializziamo gli accumulatori per questa nuova bolla
        this.thoughtTextAccumulator = '';
        this.responseTextAccumulator = '';
        this.isThinkingActive = true;
    }

    clearChat() 
    {
        if (this.panelChatMessages) {
            this.panelChatMessages.innerHTML = '';
        }
    }
    
    /**
    * Renderizza un comando UI (es. scheda di conferma con pulsanti) nella bolla dell'assistente
    */
    renderConfirm(cmd) 
    {
        if (!this.currentAssistantBubble) {
            this.createAssistantBubble();
        }
        if (typeof this.collapseThought === 'function') {
            this.collapseThought();
        }
        
        const sendBtn    = document.getElementById('osy-chatbot-input-send');
        const actionHash = sendBtn ? sendBtn.getAttribute('data-action') : '';
        const isStream   = sendBtn ? (sendBtn.getAttribute('data-stream') || '1') : '1';
        const hiddenId   = `${cmd.id}_prompt`;
        const confirmPrompt = `CONFERMATO: procedi con '${cmd.action}' usando questi parametri: ${JSON.stringify(cmd.payload)}`;
        // Costruisce i dettagli strutturati se è una mail, altrimenti usa summary
        let detailsHtml = `<p class="small text-muted mb-3">${this.escapeHtml(cmd.summary)}</p>`;
        if (cmd.action === 'mail.send' && cmd.payload) {
            detailsHtml = `
                <div class="bg-light rounded p-2 mb-3 border small">
                    <div class="mb-1">
                        <span class="text-muted font-weight-bold">A:</span> 
                        <span class="badge badge-light border text-dark">${this.escapeHtml(cmd.payload.to)}</span>
                    </div>
                    <div class="mb-2">
                        <span class="text-muted font-weight-bold">Oggetto:</span> 
                        <strong>${this.escapeHtml(cmd.payload.subject)}</strong>
                    </div>
                    <div class="border-top pt-2 text-secondary" style="white-space: pre-line; max-height: 110px; overflow-y: auto;">${this.escapeHtml(cmd.payload.body)}</div>
                </div>
            `;
        }

        const card = document.createElement('div');
        card.className = 'card mt-3 border-0 shadow-sm ai-action-card';
        card.style.borderLeft = '4px solid #007bff';
        card.id = cmd.id;

        card.innerHTML = `
            <div class="card-body p-3">
                <div class="d-flex align-items-center justify-content-between mb-2">
                    <h6 class="card-title text-primary font-weight-bold mb-0">
                        <i class="fa fa-paper-plane mr-2"></i>${this.escapeHtml(cmd.title)}
                    </h6>
                    <span class="badge badge-pill badge-light text-muted border">In attesa di conferma</span>
                </div>
                ${detailsHtml}
                <input type="hidden" id="${hiddenId}" value="${this.escapeHtml(confirmPrompt)}">
                <div class="d-flex justify-content-end">
                    <button type="button" class="btn btn-sm btn-light border mr-2 btn-ai-cancel">
                        Annulla
                    </button>
                    <button type="button"
                            id="${cmd.id}_btn"
                            class="osy-component btn btn-sm btn-primary mask-closest click-execute btn-ai-confirm px-3"
                            data-action="${actionHash}"
                            data-action-parameters="#osy-chatbot-host,#osy-chatbot-model,#${hiddenId},#osy-chatbot-key,1"
                            data-stream="${isStream}">
                        <span style="pointer-events: none;">
                            <i class="fa fa-check mr-1"></i> ${this.escapeHtml(cmd.confirm_label || 'Conferma')}
                        </span>
                    </button>
                </div>
            </div>
        `;

        // Al click: trasforma subito la card in stato compatto "Confermato" e chiude la bolla
        card.querySelector('.btn-ai-confirm').addEventListener('click', () => {
            this.finalizeStream();
            setTimeout(() => {
                card.style.borderLeftColor = '#28a745';
                card.querySelector('.card-body').innerHTML = `
                    <div class="d-flex align-items-center text-success small font-weight-bold">
                        <i class="fa fa-check-circle mr-2"></i>
                        <span>${this.escapeHtml(cmd.title)} — Confermato dall'utente</span>
                    </div>
                `;
            }, 100);
        });

        // Al click su Annulla: compatta la card in stato annullato
        card.querySelector('.btn-ai-cancel').addEventListener('click', () => {
            card.style.borderLeftColor = '#dc3545';
            card.querySelector('.card-body').innerHTML = `
                <div class="d-flex align-items-center text-muted small">
                    <i class="fa fa-times-circle text-danger mr-2"></i>
                    <span>${this.escapeHtml(cmd.title)} — Operazione annullata</span>
                </div>
            `;
        });

        this.currentAssistantBubble.appendChild(card);
        this.panelChatMessages.scrollTop = this.panelChatMessages.scrollHeight;               
    }

    notify(message, level = 'info')
    {
        if (!this.currentAssistantBubble) {
            this.createAssistantBubble();
        }
        const alert = document.createElement('div');
        alert.className = `alert alert-${level} py-2 px-3 mt-2 mb-1 small shadow-sm`;
        alert.innerHTML = `<i class="fa fa-info-circle mr-2"></i>${this.escapeHtml(message)}`;
        this.currentAssistantBubble.appendChild(alert);
        this.panelChatMessages.scrollTop = this.panelChatMessages.scrollHeight;
    }

    /**
     * 3. Apre/aggiorna il pannello operativo destro in split-view (chiamato da Ui\Workspace)
     */
    openWorkspace(title, htmlContent = '') 
    {
        if (!this.container || !this.workspacePane) return;
        this.container.classList.add('active-split-view');
        this.workspacePane.innerHTML = `
            <div class="d-flex justify-content-between align-items-center pb-2 mb-3 border-bottom">
                <h5 class="mb-0 text-primary">${this.escapeHtml(title)}</h5>
                <button type="button" class="btn btn-sm btn-outline-secondary" onclick="window.myAiChat.closeWorkspace()">
                    <i class="fa fa-times"></i>
                </button>
            </div>
            ${htmlContent}
        `;
    }

    /**
     * 4. Chiude il pannello operativo destro (chiamato da Ui\Workspace)
     */
    closeWorkspace() 
    {
        if (!this.container) return;
        this.container.classList.remove('active-split-view');
        if (this.workspacePane) {
            this.workspacePane.innerHTML = '';
        }
    }

    /**
     * 5. Navigazione o apertura scheda gestionale (chiamato da Ui\Redirect)
     */
    redirect(url, target = '_blank') 
    {
        if (target === '_self') {
            window.location.href = url;
        } else {
            window.open(url, '_blank');
        }
    }

    /**
     * 6. Compilazione campi di un form Osynapsy nella pagina (chiamato da Ui\FillForm)
     */
    fillForm(fields = {}) 
    {
        Object.entries(fields).forEach(([fieldId, value]) => {
            const el = document.getElementById(fieldId);
            if (el) {
                el.value = value;
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }

   escapeHtml(str)
   {
       const div = document.createElement('div');
       div.textContent = str ?? '';
       return div.innerHTML;
   }
}

document.addEventListener('DOMContentLoaded', function () {    
    // Istanziamo l'oggetto globale o locale della chat
    window.myAiChat = new ChatUI({
        panelChatMessagesSelector: '#osy-chatbot-messages',
        //divThoughtSelector : '#osy-chatbot-message-thought',
        //divContentSelector : '#osy-chatbot-message-content',
        inputSelector: '#osy-chatbot-input',
        buttonSelector: '#osy-chatbot-input-send'
    });    
});