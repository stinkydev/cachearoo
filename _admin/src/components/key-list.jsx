import React from 'react';
import { Button, Form, Table } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import PropTypes from 'prop-types';
import KeyEditor from './key-editor';
import ConfirmDialog from './confirm-dialog';

function bytesFormat(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return 'n/a';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
  return `${Math.round(bytes / (1024 ** i), 2)} ${sizes[i]}`;
}

function timeFormat(time) {
  const d = new Date(time);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

export default class KeyList extends React.Component {
  constructor() {
    super();
    this.confirm = React.createRef();
    this.keyEditor = React.createRef();
    this.state = {
      keys: [],
      selected: [],
      filter: '',
      page: 1,
      sizePerPage: 15,
      sortField: 'key',
      sortDirection: 'asc',
    };
  }

  componentDidMount() {
    const { id } = this.props;
    this.bucket = id;
    globalThis.de.connection.addListener(this.bucket, '*', false, this.reloadData);
    this.reloadData();
  }

  componentWillUnmount() {
    globalThis.de.connection.removeListener(this.reloadData);
  }

  handleOnSelect = (row, isSelect) => {
    if (isSelect) {
      this.setState((state) => (
        { selected: Array.from(new Set([...state.selected, row.key])) }
      ));
    } else {
      this.setState((state) => ({
        selected: state.selected.filter((x) => x !== row.key),
      }));
    }
  }

  handleOnSelectAll = (isSelect, rows) => {
    const ids = rows.map((r) => r.key);
    if (isSelect) {
      this.setState((state) => ({
        selected: Array.from(new Set([...state.selected, ...ids])),
      }));
    } else {
      this.setState((state) => ({
        selected: state.selected.filter((key) => !ids.includes(key)),
      }));
    }
  }

  handleFilterChange = (ev) => {
    this.setState({ filter: ev.target.value, page: 1 });
  }

  handleSizeChange = (ev) => {
    this.setState({ sizePerPage: parseInt(ev.target.value, 10), page: 1 });
  }

  setPage = (page) => {
    this.setState({ page });
  }

  sortBy = (field) => {
    this.setState((state) => ({
      sortField: field,
      sortDirection: state.sortField === field && state.sortDirection === 'asc' ? 'desc' : 'asc',
    }));
  }

  deEvent = () => {
    this.reloadData();
  }

  deleteKeys = () => {
    const { selected } = this.state;
    if (selected.length === 0) return;

    this.confirm.current.show('Delete keys', `Really delete ${(selected.length <= 1) ? selected[0] : `${selected.length} keys`}?`, async () => {
      const promises = selected.map((item) => globalThis.de.remove(item, { bucket: this.bucket }));
      await Promise.all(promises);
      this.reloadData();
    });
  }

  newKey = () => {
    this.keyEditor.current.show('New key', '', {}, (key, value) => {
      globalThis.de.write(key, value, { forceHttp: true, bucket: this.bucket })
        .then(() => {
          this.keyEditor.current.cancel();
          this.reloadData();
        });
    });
  }

  rowClicked = async (ev, row) => {
    const val = await globalThis.de.read(row.key, { bucket: this.bucket });
    this.keyEditor.current.show(row.key, row.key, val, async (key, value) => {
      await globalThis.de.write(key, value, { bucket: this.bucket });
      this.keyEditor.current.cancel();
      this.reloadData();
    });
  }

  reloadData = async () => {
    const data = await globalThis.de.read('', { keysOnly: true, forceHttp: true, bucket: this.bucket });
    this.setState({ keys: data, selected: [] });
  }

  render() {
    const {
      keys, selected, filter, page, sizePerPage, sortField, sortDirection,
    } = this.state;

    const filteredKeys = keys
      .filter((item) => item.key.toLowerCase().includes(filter.toLowerCase()))
      .sort((a, b) => {
        const left = a[sortField];
        const right = b[sortField];
        if (left === right) return 0;
        const result = left > right ? 1 : -1;
        return sortDirection === 'asc' ? result : -result;
      });

    const pageCount = Math.max(Math.ceil(filteredKeys.length / sizePerPage), 1);
    const currentPage = Math.min(page, pageCount);
    const start = (currentPage - 1) * sizePerPage;
    const visibleKeys = filteredKeys.slice(start, start + sizePerPage);
    const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((item) => selected.includes(item.key));
    const sortLabel = (field) => (sortField === field ? (sortDirection === 'asc' ? ' asc' : ' desc') : '');

    return (
      <div className="tableMargin">
        <KeyEditor ref={this.keyEditor} />
        <ConfirmDialog ref={this.confirm} />
        <div className="page-header">
          <div>
            <h1>{this.bucket}</h1>
            <p>{`${filteredKeys.length} keys${selected.length ? `, ${selected.length} selected` : ''}`}</p>
          </div>
          <div className="action-row">
            <Button variant="primary" size="sm" onClick={this.newKey}>
              <FontAwesomeIcon icon={faPlus} />
              {' '}
              New
            </Button>
            <Button variant="outline-danger" size="sm" onClick={this.deleteKeys} disabled={selected.length === 0}>
              <FontAwesomeIcon icon={faTrash} />
              {' '}
              Delete
            </Button>
          </div>
        </div>
        <div className="table-toolbar">
          <Form.Control
            size="sm"
            type="search"
            value={filter}
            onChange={this.handleFilterChange}
            placeholder="Filter by key"
            aria-label="Filter keys"
          />
          <Form.Select size="sm" value={sizePerPage} onChange={this.handleSizeChange} aria-label="Rows per page">
            <option value="15">15 rows</option>
            <option value="50">50 rows</option>
            <option value="100">100 rows</option>
          </Form.Select>
        </div>
        <div className="tableBorder">
          <Table responsive size="sm" hover className="admin-table">
            <thead>
              <tr>
                <th className="check-cell">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(ev) => this.handleOnSelectAll(ev.target.checked, visibleKeys)}
                    aria-label="Select visible keys"
                  />
                </th>
                <th><button type="button" className={`table-sort${sortLabel('key')}`} onClick={() => this.sortBy('key')}>Key</button></th>
                <th><button type="button" className={`table-sort${sortLabel('size')}`} onClick={() => this.sortBy('size')}>Size</button></th>
                <th><button type="button" className={`table-sort${sortLabel('timestamp')}`} onClick={() => this.sortBy('timestamp')}>Last written</button></th>
              </tr>
            </thead>
            <tbody>
              {visibleKeys.map((item) => (
                <tr key={item.key} onClick={(ev) => this.rowClicked(ev, item)}>
                  <td className="check-cell" onClick={(ev) => ev.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.includes(item.key)}
                      onChange={(ev) => this.handleOnSelect(item, ev.target.checked)}
                      aria-label={`Select ${item.key}`}
                    />
                  </td>
                  <td className="key-cell">{item.key}</td>
                  <td>{bytesFormat(item.size)}</td>
                  <td>{timeFormat(item.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          {visibleKeys.length === 0 ? (
            <div className="empty-state table-empty">
              <h2>No keys found</h2>
              <p>{filter ? 'Try a different filter.' : 'Create a key to get started.'}</p>
            </div>
          ) : null}
        </div>
        <div className="pagination-row">
          <Button variant="outline-secondary" size="sm" disabled={currentPage <= 1} onClick={() => this.setPage(currentPage - 1)}>Previous</Button>
          <span>{`Page ${currentPage} of ${pageCount}`}</span>
          <Button variant="outline-secondary" size="sm" disabled={currentPage >= pageCount} onClick={() => this.setPage(currentPage + 1)}>Next</Button>
        </div>
      </div>
    );
  }
}

KeyList.propTypes = {
  id: PropTypes.string.isRequired,
};
