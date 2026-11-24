<?php
namespace Osynapsy\Ai\Chatbot;

use Osynapsy\Html\Component\Panel;
use Osynapsy\Html\Component\Button;
use Osynapsy\Html\Component\Link;
use Osynapsy\Html\Component\ComboBox;
use Osynapsy\Html\Component\TextArea;
use Osynapsy\Html\Tag;
use Osynapsy\Ai\Tools\ToolCall;

/**
 * Description of PanelMain
 *
 * @author Pietro Celeste <p.celeste@qanda.cc>
 */
class ChatBot extends Panel
{
    protected $model;
    protected $stream = 0;
    protected $route;
    protected $classSendPrompt;
    protected $classDeleteChat;
    protected $sidebarEnabled = true;
    protected $parsedown;

    public function __construct(string $id, string $route, $rowClass = null, $cellClass = null, $tag = 'div')
    {
        parent::__construct($id, $rowClass, $cellClass, $tag);
        $this->route = $route;
        $this->requireCss('ocl/chatbot/css/style.css');
        $this->requireJs('ocl/chatbot/js/marked.min.js');
        $this->requireJs('ocl/chatbot/js/purify.min.js');
        $this->requireJs('ocl/chatbot/js/script.js');
        // 1. Rendiamo il pannello principale un contenitore flex a tutta altezza
        $this->addClass('container-fluid d-flex flex-column p-0 overflow-hidden osy-chatbot');
        $this->parsedown = new \Parsedown();
        $this->parsedown->setSafeMode(true);
    }

    public function setModel($model) : static
    {
        $this->model = $model;
        $this->buildUI();
        return $this;
    }

    public function getModel()
    {
        return $this->model;
    }

    protected function buildUI(): void
    {
        // Riga principale che si espande occupando tutto lo spazio verticale disponibile
        $row = $this->addRow()->addClass('flex-grow-1 m-0 overflow-hidden osynapsy-ai-chatbot-container');
        if ($this->sidebarEnabled) {
            // 1. Sidebar delle Chat (Sinistra)
            $row->add($this->sideBarFactory());
        }

        // 2. Area Principale della Chat / Workspace Dinamico (Destra)
        $row->add($this->mainAreaFactory());
        $row->add($this->workspacePaneFactory());
    }

    protected function sideBarFactory()
    {
        // Aggiunto h-100 per forzare la sidebar a riempire l'altezza della riga
        $sidebar = new Tag('div', null, 'col-md-2 chat-sidebar border-right d-flex flex-column p-3 bg-white h-100');
        $sidebar->add($this->buttonNewChatFactory());
        $sidebar->add($this->panelChatListFactory());
        return $sidebar;
    }

    protected function buttonNewChatFactory()
    {
        return new Link('osy-chatbot-new-chat', route($this->route, ['']), '<i class="fa fa-plus"></i> Nuovo', 'btn btn-link btn-sm');
    }

    protected function panelChatListFactory()
    {
        $Panel = new Panel('osy-chatbot-chat-list', 'chat-title', 'col', 'div');
        $Panel->addClass('chat-history-list flex-grow-1 overflow-auto');
        foreach($this->getModel()->getChats() as $rec) {
            $color = route()->getParameter(0) == $rec['id'] ? 'text-dark text-bold' : 'text-muted';
            $row = $Panel->addRow();
            $row->add(new Link(false, route($this->route, [$rec['id']]), $rec['ttl'], 'text-nowrap text-truncate '.$color));
            if (!empty($this->classDeleteChat)) {
                $row->add(new Link(false, false, '', 'delete-chat fa fa-trash float-right'))->setAction($this->classDeleteChat, [$rec['id']], sprintf('Sei sicuro di voler eliminare la chat "%s"', $rec['ttl']));
            }
        }
        return $Panel;
    }

    protected function mainAreaFactory()
    {
        $mainArea = new Tag('div', null, 'col-12 col-md-10 chat-main-workspace d-flex flex-column h-100 p-0 bg-light');
        // Contenitore dei messaggi (occupa tutto lo spazio rimanente e attiva lo scroll)
        $mainArea->add($this->messagesAreaFactory());
        // Barra di input in basso (flessibile e protetta dalla compressione)
        $mainArea->add($this->inputAreaFactory());
        return $mainArea;
    }

    protected function messagesAreaFactory()
    {
        $Panel = new Tag('div', 'osy-chatbot-messages', 'chat-messages-container flex-grow-1 overflow-auto p-4');
        foreach($this->getModel()->getMessages() as $message) {
            if (!empty($message['content'])) {
                $Panel->add($this->messageBoxFactory($message));
            }
        }
        return $Panel;
    }

    protected function messageBoxFactory($msg)
    {
        $msgBox = new Tag('div', null, "chat-message {$msg['role']}-message");
        $msgBox->add(match($msg['role']) {
            'user' => $this->userMessageFactory($msg['content'], $msg['images'] ?? null),
            default => $this->assistantMessageFactory($msg)
        });
        return $msgBox;
    }

    protected function userMessageFactory($content, $images)
    {
        $dummy = new Tag('dummy');
        if (!empty($images)) {
            $dummy->add($this->userImageFactory($images));
        }
        $dummy->Add((new Tag('div', null, 'message-text'))->add($content));
        return $dummy;
    }

    protected function userImageFactory($rawimages)
    {
        $images = unserialize($rawimages);
        $dummy = new Tag('dummy');
        foreach($images as $image) {
            $dummy->add(new Tag('div', null, 'mb-2 d-flex flex-wrap gap-2'))
                  ->add(new Tag('img', null, 'rounded border'))
                  ->attribute('style', "max-height: 160px; max-width: 100%")
                  ->attribute('src', $image->getWebPath());
        }
        return $dummy;
    }

    protected function assistantMessageFactory($msg)
    {
        $parsedown = new \Parsedown();
        $parsedown->setSafeMode(true);
        $dummy = new Tag('dummy');
        if (!empty($msg['reasoning'])) {
            $dummy->add($this->messageReasoningFactory($this->parsedown ? $this->parsedown->text($msg['reasoning']) : $msg['reasoning']));
        }
        $dummy->add($this->messageContentFactory($this->parsedown ? $this->parsedown->text($msg['content']) : $msg['content'], $msg['tool_calls'] ?? null));
        return $dummy;
    }

    protected function messageReasoningFactory($reasoning)
    {
        $thk = new Tag('div', null, 'chat-thought-box text-muted small mb-2 p-2 bg-light border-left border-primary rounded');
        $thk->add(new Tag('i', null, 'fa fa-check text-success'));
        $thk->add('Ragionamento completato');
        $thk->add(new Tag('small', null, 'text-info float-right cursor-pointer'))->attribute('onclick', "this.nextElementSibling.classList.toggle('d-none')")->add('[Mostra]');
        $thk->add(new Tag('div', null, 'thought-collapsed-content mt-2 p-2 bg-white border rounded small d-none message-text'))
            ->add($reasoning);
        return $thk;
    }

    protected function messageContentFactory($content, $toolCalls)
    {
        $cnt = new Tag('div', null, 'chat-response-box');
        $txt = $cnt->add(new Tag('div', null, 'response-text message-text'));
        $txt->add($content);
        if (!empty($toolCalls)) {
            $txt->add($this->messageToolCallFactory($toolCalls));
        }
        return $cnt;
    }

    protected function messageToolCallFactory($strToolCall)
    {
        $dummy = new Tag('dummy');
        $toolCall = unserialize($strToolCall);
        if (in_array($toolCall->getTool(), ['ui.workspace', 'ui_workspace'])) {
             $arg = $toolCall->getArguments();
             $dummy->add(new Tag('a'))->setHref('javascript:void(0)')->setOnclick("myAiChat.openWorkspace('{$arg['title']}', this.nextElementSibling.innerHTML);")->add($arg['title']);
             $dummy->add(new Tag('div', null, 'd-none'))->add($arg['html']);
        }
        return $dummy;
    }

    protected function inputAreaFactory()
    {
        $inputArea = new Tag('div', null, 'chat-input-bar p-3 border-top bg-white flex-shrink-0');
        $inputArea->add($this->imagesAreaFactory());
        $inputArea->add($this->formFactory());
        return $inputArea;
    }

    protected function imagesAreaFactory()
    {
        $dummy = new Tag('dummy');
        $dummy->add(new Tag('div', 'osy-chatbot-image-previews', 'px-3 pt-2 d-none'));
        $hiddenImages = new Tag('input', 'osy-chatbot-images');
        $hiddenImages->attribute('type', 'hidden');
        $hiddenImages->attribute('name', 'osy-chatbot-images');
        $dummy->add($hiddenImages);
        return $dummy;
    }

    protected function formFactory()
    {
        $Form = new Panel('panelForm');
        $Form->addClass('w-100 mask');
        $Form->addCell('col-12')->add(new Tag('div', null, 'input-group'))->add($this->fieldPromptFactory())->addClass('form-control');
        $Form->addRow();
        $Form->addCell('col-3')->add($this->fieldHostFactory());
        $Form->addCell('col-3')->add($this->fieldModelFactory());
        $Form->addCell('col-5 overflow-hidden')->add($this->fieldKeyFactory());
        $Form->addCell('col-1')->add($this->buttonSendPromptFactory());
        return $Form;
    }

    protected function fieldPromptFactory()
    {
        $TextArea = new TextArea('osy-chatbot-input');
        $TextArea->setPlaceholder('Chiedi a Chatty');
        $TextArea->addClass('border-0 mb-2')->setRows('3');
        return $TextArea;
    }

    protected function fieldHostFactory()
    {
        $ComboBox = new ComboBox('osy-chatbot-host');
        $ComboBox->addClass('form-control-sm border-0');
        $ComboBox->setPlaceholder('Seleziona l\'host');
        $ComboBox->setDataset($this->getModel()->getHosts());
        $ComboBox->attribute('onchange', "Osynapsy.refreshComponents(['osy-chatbot-model', 'osy-chatbot-key'])");
        return $ComboBox;
    }

    protected function fieldModelFactory()
    {
        $ComboBox = new ComboBox('osy-chatbot-model');
        $ComboBox->setPlaceholder('Seleziona il modello');
        $ComboBox->addClass('form-control-sm border-0');
        $ComboBox->setDataset($this->getModel()->getModels($_REQUEST['osy-chatbot-host'] ?? null));
        return $ComboBox;
    }

    protected function fieldKeyFactory()
    {
        $keys = $this->getModel()->getKeys($_REQUEST['osy-chatbot-host'] ?? null);
        $ComboBox = new ComboBox('osy-chatbot-key');
        $ComboBox->addClass('form-control-sm'. (empty($keys) ? ' d-none' : ''))
                 ->setPlaceholder('Seleziona la chiave')
                 ->setDataset($keys);
        return $ComboBox;
    }

    protected function buttonSendPromptFactory()
    {
        $Button = new Button('osy-chatbot-input-send', '<i class="fa fa-arrow-up"></i>', 'btn-primary btn-sm rounded-circle mask-closest');
        $Button->attribute('style', 'width: 38px; height: 38px; flex-shrink: 0;');
        $Button->setAction($this->classSendPrompt, ['#osy-chatbot-host', '#osy-chatbot-model', '#osy-chatbot-input', '#osy-chatbot-images', '#osy-chatbot-key', $this->stream]);
        if ($this->stream) {
            $Button->attribute('data-stream', 1);
        }
        return $Button;
    }

    protected function workspacePaneFactory()
    {
        return new Tag('div', 'osy-chatbot-workspace', 'dynamic-workspace-pane p-4 border-left bg-white');
    }

    public function setStream(bool $v)
    {
        $this->stream = $v ? 1 : 0;
        return $this;
    }

    public function setActionSendPrompt(string $classActionSendPrompt)
    {
        $this->classSendPrompt = $classActionSendPrompt;
        return $this;
    }

    public function setActionDeleteChat(string $classActionDeleteChat)
    {
        $this->classDeleteChat = $classActionDeleteChat;
        return $this;
    }

    public function sidebar(bool $show)
    {
        $this->sidebarEnabled = $show;
        return $this;
    }
}