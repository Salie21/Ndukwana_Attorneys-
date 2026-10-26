import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, RotateCcw, Send, X } from 'lucide-react';
import { api } from '../lib/api';
import { useI18n } from '../i18n/I18nProvider';

const STORE = 'chat:v1';

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const load = () => {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORE));
    return Array.isArray(value) && value.length ? value : null;
  } catch {
    return null;
  }
};

const save = (messages) => {
  try {
    sessionStorage.setItem(
      STORE,
      JSON.stringify(messages.map(({ fresh, ...message }) => message))
    );
  } catch {
    // Session storage may be unavailable.
  }
};

const FRESH = [{ role: 'assistant', greeting: true }];

// Assistant replies appear word by word.
// Screen readers receive the entire reply at once.
function Reply({ text, animate, onTick, onDone }) {
  const parts = useMemo(() => text.split(/(\s+)/), [text]);

  const [shown, setShown] = useState(() =>
    animate && !prefersReducedMotion() ? 0 : parts.length
  );

  useEffect(() => {
    if (shown >= parts.length) {
      if (animate) onDone?.();
      return undefined;
    }

    const id = setTimeout(() => {
      setShown((count) => count + 1);
      onTick?.();
    }, 22);

    return () => clearTimeout(id);
  }, [shown, parts.length, animate, onTick, onDone]);

  if (shown >= parts.length && !animate) {
    return text;
  }

  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {parts.slice(0, shown).map((part, index) => (
          <span key={index} className="wd">
            {part}
          </span>
        ))}
      </span>
    </>
  );
}

export default function ChatWidget() {
  const { t, lang } = useI18n();
  // Free hosting puts the server to sleep. Ping it as soon as the page opens so it is awake when someone asks a question.
  useEffect(() => { fetch(`${import.meta.env.VITE_API_URL || ''}/api/health`).catch(() => {}); }, []);

  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState(() => load() || FRESH);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const end = useRef(null);
  const chat = useRef(null);
  const input = useRef(null);
  const pending = useRef(null);

  const scrollDown = useCallback(
    () => end.current?.scrollIntoView({ block: 'end' }),
    []
  );

  useEffect(() => {
    save(msgs);
  }, [msgs]);

  useEffect(() => {
    end.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [msgs, busy, open]);

  useEffect(() => {
    return () => pending.current?.abort();
  }, []);

  useEffect(() => {
    if (!open) return;

    input.current?.focus({ preventScroll: true });

    const viewport = window.visualViewport;

    const updateViewport = () => {
      if (!viewport || !chat.current) return;

      chat.current.style.setProperty(
        '--chat-viewport-height',
        `${viewport.height}px`
      );

      chat.current.style.setProperty(
        '--chat-viewport-top',
        `${viewport.offsetTop}px`
      );
    };

    updateViewport();

    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);

    return () => {
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', closeOnEscape);

    return () => {
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  // Send the conversation to the server and append its reply.
  // IMPORTANT: await is valid here because this function is async.
  async function ask(list) {
    setMsgs(list);
    setBusy(true);

    const ctrl = new AbortController();
    pending.current = ctrl;

    const timer = setTimeout(() => ctrl.abort(), 75000);

    try {
      // Send real conversation turns only.
      const history = list
        .filter(
          (message) =>
            !message.greeting &&
            !message.error &&
            typeof message.text === 'string' &&
            message.text
        )
        .slice(-7)
        .map(({ role, text: messageText }) => ({
          role,
          text: messageText,
        }));

      // Ensure the history starts with a visitor message.
      while (history.length && history[0].role !== 'user') {
        history.shift();
      }

      if (!history.length) {
        throw new Error(t('chat.unreachable'));
      }

      const data = await api('/chat', {
        method: 'POST',
        body: {
          messages: history,
          language: lang,
        },
        auth: false,
        signal: ctrl.signal,
      });

      if (
        typeof data?.reply !== 'string' ||
        !data.reply.trim()
      ) {
        throw new Error(t('chat.unreachable'));
      }

      setMsgs((messages) => [
        ...messages,
        {
          role: 'assistant',
          text: data.reply.trim(),
          fresh: true,
        },
      ]);
    } catch (error) {
      // Ignore intentional aborts, such as resetting the chat.
      if (
        ctrl.signal.aborted &&
        !(error.message || '').includes('too long')
      ) {
        return;
      }

      setMsgs((messages) => [
        ...messages,
        {
          role: 'assistant',
          text: error.message || t('chat.unreachable'),
          error: true,
        },
      ]);
    } finally {
      clearTimeout(timer);

      // Do not let an older request overwrite a newer request's state.
      if (pending.current === ctrl) {
        pending.current = null;
        setBusy(false);
        input.current?.focus({ preventScroll: true });
      }
    }
  }

  // Only ask() makes the API request.
  // Do not add another await/api() call inside this function.
  function send(question) {
    const q = (question ?? text).trim();

    if (!q || busy) return;

    setText('');

    ask([
      ...msgs,
      {
        role: 'user',
        text: q,
      },
    ]);
  }

  const retry = () => {
    if (!busy) {
      ask(msgs.filter((message) => !message.error));
    }
  };

  const reset = () => {
    pending.current?.abort();
    pending.current = null;

    setBusy(false);
    setMsgs(FRESH);
    setText('');

    input.current?.focus({ preventScroll: true });
  };

  const settle = (index) => {
    setMsgs((messages) =>
      messages[index]?.fresh
        ? messages.map((message, i) =>
            i === index
              ? { ...message, fresh: false }
              : message
          )
        : messages
    );
  };

  if (!open) {
    return (
      <div className="fab-stack">
        <button
          className="fab bot"
          onClick={() => setOpen(true)}
          aria-label={t('chat.open')}
          aria-haspopup="dialog"
        >
          <Bot size={26} />
        </button>
      </div>
    );
  }

  const lastIsError = msgs.at(-1)?.error;

  return (
    <section
      ref={chat}
      className="chatbox"
      role="dialog"
      aria-modal="false"
      aria-labelledby="chat-title"
    >
      <div className="chat-head">
        <Bot
          size={26}
          color="#cda65e"
          style={{ flex: 'none' }}
        />

        <div className="grow" style={{ minWidth: 0 }}>
          <b id="chat-title">{t('chat.title')}</b>
          <small>{t('chat.sub')}</small>
        </div>

        {msgs.length > 1 && (
          <button
            className="icon-btn chat-icon"
            onClick={reset}
            aria-label={t('chat.new')}
            title={t('chat.new')}
          >
            <RotateCcw size={16} />
          </button>
        )}

        <button
          className="icon-btn chat-icon"
          onClick={() => setOpen(false)}
          aria-label={t('chat.close')}
        >
          <X size={18} />
        </button>
      </div>

      <div className="chat-body" aria-live="polite">
        {msgs.map((message, index) => (
          <div
            key={index}
            className={`bub ${
              message.role === 'user' ? 'me' : 'bot'
            }${message.error ? ' err' : ''}`}
          >
            {message.greeting ? (
              t('chat.greeting')
            ) : message.role === 'user' || message.error ? (
              message.text
            ) : (
              <Reply
                text={message.text}
                animate={!!message.fresh}
                onTick={scrollDown}
                onDone={() => settle(index)}
              />
            )}
          </div>
        ))}

        {msgs.length === 1 && (
          <div className="quick">
            {['chat.q1', 'chat.q2', 'chat.q3'].map((key) => (
              <button key={key} onClick={() => send(t(key))}>
                {t(key)}
              </button>
            ))}
          </div>
        )}

        {lastIsError && !busy && (
          <div className="quick">
            <button onClick={retry}>
              <RotateCcw
                size={13}
                style={{
                  marginRight: 5,
                  verticalAlign: '-2px',
                }}
              />
              {t('chat.retry')}
            </button>
          </div>
        )}

        {busy && (
          <div
            className="bub bot typing"
            role="status"
            aria-label={t('chat.typing')}
          >
            <i />
            <i />
            <i />
          </div>
        )}

        <div ref={end} />
      </div>

      <div className="chat-note">{t('chat.note')}</div>

      <form
        className="chat-foot"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <input
          ref={input}
          className="input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={500}
          placeholder={t('chat.placeholder')}
          aria-label={t('chat.label')}
          enterKeyHint="send"
          autoComplete="off"
        />

        <button
          className="btn btn-gold"
          disabled={busy || !text.trim()}
          aria-label={t('chat.send')}
        >
          <Send size={18} />
        </button>
      </form>
    </section>
  );
}

