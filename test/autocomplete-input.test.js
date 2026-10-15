import { expect, fixture, oneEvent, nextFrame, aTimeout } from '@open-wc/testing';
import '../src/autocomplete-input';
import { assert } from '@esm-bundle/chai';
import { sendKeys } from '@web/test-runner-commands';

it('renders the slot when in initial state', async () => {
  const el = await fixture(`
    <autocomplete-input name="foo">bar</autocomplete-input>
  `);
  expect(el.innerHTML).to.equal('bar');
})

it('displays an input when opened', async () => {
  const el = await fixture(`
    <autocomplete-input name="foo" search-value="abc">bar</autocomplete-input>
  `);
  el.shadowRoot.querySelector('button.display-wrapper').click();
  await el.updated;
  const searchInput = el.shadowRoot.querySelector('input');
  expect(searchInput).to.exist;
  expect(el.hasState('open')).to.be.true;
});

it('emits an autocomplete-search event', async () => {
  const el = await fixture(`
    <autocomplete-input name="foo" open debounce="10"></autocomplete-input>
  `);
  const searchInput = el.shadowRoot.querySelector('input');
  searchInput.value = 'bar';
  searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  const { detail } = await oneEvent(el, 'autocomplete-search');
  expect(detail.query).to.equal('bar');
  expect(detail.name).to.equal('foo');
});

it('only dispatches search event when the mininum length is met', async () => {
  const el = await fixture(`
    <autocomplete-input name="foo" open min-length="3" debounce="10"></autocomplete-input>
  `);
  el.addEventListener('autocomplete-search', () => { 
    assert.fail();
  });
  const searchInput = el.shadowRoot.querySelector('input');
  searchInput.value = 'f';
  searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  await el.updated;
});

describe('the combobox', () => {
  it('builds a combobox and sends autocomplete-commit for a slotted list', async () => {
    const el = await fixture(`
      <autocomplete-input name="bar" open items='[{"value": "foo", "label": "Foo"}]'>
      </autocomplete-input>
    `);
    const option = el.shadowRoot.querySelector('li[data-value="foo"]');
    el.addEventListener('autocomplete-commit', (e) => {
      console.debug(e.detail)
      expect(e.detail.value).to.equal('foo');
      expect(e.detail.name).to.equal('bar');
    });
    option.click();
  });

  it('sets values when an option is clicked', async () => {
    const formElement = await fixture(`
        <form>
          <autocomplete-input name="foo" open items='[{"value": "bar", "label": "Bar"}]'>
          </autocomplete-input>
        </form>
      `);
    const autocompleteElement = formElement.querySelector('autocomplete-input');
    const option = autocompleteElement.shadowRoot.querySelector('li[data-value="bar"]');
    option.click();
    expect(new FormData(formElement).get('foo')).to.eq('bar');
  });

  it('sets form value from value attribute', async () => {
    const formElement = await fixture(`
      <form>
        <autocomplete-input name="foo" value="bar" open>
          <ul slot="list">
            <li role="option" data-value="bar">Bar</li>
          </ul>
        </autocomplete-input>
      </form>
    `);
    expect(new FormData(formElement).get('foo')).to.eq('bar')
  });

});

describe('the closed-state trigger', () => {
  const trigger = (el) => el.shadowRoot.querySelector('button.display-wrapper');
  const focused = (el) => el.shadowRoot.activeElement;

  it('is a non-submitting button', async () => {
    const el = await fixture(`<autocomplete-input name="foo" display-value="Alice"></autocomplete-input>`);
    expect(trigger(el).getAttribute('type')).to.equal('button');
    expect(trigger(el).getAttribute('part')).to.equal('trigger');
    expect(trigger(el).querySelector('span').textContent).to.equal('Alice');
  });

  it('uses the label as its accessible name when there is no display text', async () => {
    const el = await fixture(`<autocomplete-input name="foo" display-value="" label="Reassign owner"></autocomplete-input>`);
    expect(trigger(el).getAttribute('aria-label')).to.equal('Reassign owner');
    expect(trigger(el).querySelector('span')).to.be.null;
  });

  it('keeps the display text first in its accessible name', async () => {
    const el = await fixture(`<autocomplete-input name="foo" display-value="Alice" label="Reassign owner"></autocomplete-input>`);
    expect(trigger(el).getAttribute('aria-label')).to.equal('Alice, Reassign owner');
  });

  it('has no aria-label without a label, so the display text names it', async () => {
    const el = await fixture(`<autocomplete-input name="foo" display-value="Alice"></autocomplete-input>`);
    expect(trigger(el).hasAttribute('aria-label')).to.be.false;
  });

  it('is reachable with Tab and opens on Enter, focusing the search input', async () => {
    const el = await fixture(`<autocomplete-input name="foo" display-value="" label="Pick"></autocomplete-input>`);
    let opened = false;
    el.addEventListener('autocomplete-open', () => { opened = true; });
    await sendKeys({ press: 'Tab' });
    expect(focused(el)).to.equal(trigger(el));
    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect(opened).to.be.true;
    expect(focused(el)).to.equal(el.searchInput);
  });

  it('opens on Space', async () => {
    const el = await fixture(`<autocomplete-input name="foo"></autocomplete-input>`);
    trigger(el).focus();
    await sendKeys({ press: 'Space' });
    await el.updateComplete;
    expect(el.open).to.be.true;
    expect(focused(el)).to.equal(el.searchInput);
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const el = await fixture(`<autocomplete-input name="foo"></autocomplete-input>`);
    trigger(el).focus();
    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    setTimeout(() => sendKeys({ press: 'Escape' }));
    await oneEvent(el, 'autocomplete-close');
    await el.updateComplete;
    expect(el.open).to.be.false;
    expect(trigger(el)).to.exist;
    expect(focused(el)).to.equal(trigger(el));
  });

  it('returns focus to the trigger when the clear button closes it', async () => {
    const el = await fixture(`<autocomplete-input name="foo" open></autocomplete-input>`);
    el.shadowRoot.querySelector('button.cancel-icon').click();
    await el.updateComplete;
    expect(el.open).to.be.false;
    expect(trigger(el)).to.exist;
    expect(focused(el)).to.equal(trigger(el));
  });

  it('returns focus to the trigger after a commit', async () => {
    const el = await fixture(`<autocomplete-input name="foo" open items='[{"value": "bar", "label": "Bar"}]'></autocomplete-input>`);
    el.shadowRoot.querySelector('li[data-value="bar"]').click();
    await el.updateComplete;
    expect(el.open).to.be.false;
    expect(trigger(el)).to.exist;
    expect(focused(el)).to.equal(trigger(el));
  });
});
