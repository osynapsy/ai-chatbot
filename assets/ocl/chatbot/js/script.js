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
        this.init();
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
         /*
            this.inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        */
    }

    /**
     * Metodo pubblico per inviare un messaggio
     */
    sendMessage(customText = null) 
    {         
        const text = customText || this.inputField.value.trim();
        if (!text) return;

        this.appendMessage('user', text);
        if (!customText && this.inputField) {
            //setTimeout(() => {this.inputField.value = ''}, 1000);
        }
        this.currentAssistantBubble = null;
        this.thoughtDiv = null;
        this.responseDiv = null;
        this.thoughtTextAccumulator = '';
        this.responseTextAccumulator = '';
        this.isThinkingActive = true;
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
            thoughtContentContainer.textContent = this.thoughtTextAccumulator;
            
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

        // Accumula e stampa la risposta reale
        this.responseTextAccumulator += text;
        this.responseDiv.querySelector('.response-text').textContent = this.responseTextAccumulator;
        
        // Scroll automatico in basso
        this.panelChatMessages.scrollTop = this.panelChatMessages.scrollHeight;
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