import React from 'react';
import { Table, Button } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

import ConfirmDialog from './confirm-dialog';
import BucketListItem from './bucket-list-item';
import ReplicationDialog from './replication-dialog';
import InputDialog from './input-dialog';

export default class BucketList extends React.PureComponent {
  constructor() {
    super();
    this.bucket = '_bucket_config';
    this.replicationDlg = React.createRef();
    this.inputDlg = React.createRef();
    this.confirmDlg = React.createRef();
    this.state = { buckets: [] };
  }

  componentDidMount() {
    this.reloadData();
  }

  onShowReplicationDlg = (item) => {
    this.showReplicationDialog(item);
  }

  deleteBucket = (item) => {
    this.confirmDlg.current.show(`Delete bucket - ${item.key}`, 'Are you sure?', () => {
      globalThis.de.remove(item.key, { bucket: this.bucket })
        .then(() => {
          this.reloadData(0);
        });
    });
  }

  repairBucket = (item) => {
    this.confirmDlg.current.show(`Repair bucket - ${item.key}`, 'Are you sure?', () => {
      globalThis.de.repair(item.key)
        .then(() => {
          this.confirmDlg.current.show('Repair', 'Successfully repaired bucket', () => {
            this.reloadData(0);
          }, true);
        })
        .catch((err) => this.confirmDlg.current.show('Repair failed', err, () => {
          // nothing
        }, true));
    });
  }

  toggleEnable = async (item) => {
    const cfg = item.config;

    // toggle disabled
    cfg.disabled = !cfg.disabled;

    await globalThis.de.write(item.key, cfg, { bucket: this.bucket });
    this.reloadData(1000);
  }

  reloadData = async (delay) => {
    setTimeout(async () => {
      const data = await globalThis.de.read('', { bucket: this.bucket, keysOnly: true });
      this.setState({ buckets: data });
    }, delay || 0);
  }

  showReplicationDialog = (item) => {
    this.replicationDlg.current.open(item);
  }

  closeReplicationDialog = async (result) => {
    if (result.isOK) {
      const obj = {
        replicationURI: result.uri,
        replication: result.enabled,
      };
      if ((result.apiKey) && (result.apiKey.trim() !== '')) {
        obj.apiKey = result.apiKey;
      }

      await globalThis.de.write(result.bucket, obj, { bucket: this.bucket });
      this.reloadData(1000);
    }
  }

  createBucket = () => {
    this.inputDlg.current.show('Create bucket', [{ message: 'Bucket name', value: '' }], async (values) => {
      await globalThis.de.write(values[0], {}, { bucket: this.bucket });
      this.reloadData();
    });
  }

  render() {
    const { buckets } = this.state;

    return (
      <div>
        <ConfirmDialog ref={this.confirmDlg} />
        <InputDialog ref={this.inputDlg} />
        <ReplicationDialog ref={this.replicationDlg} onClose={this.closeReplicationDialog} />
        <div className="tableMargin">
          <div className="page-header">
            <div>
              <h1>Buckets</h1>
            </div>
            <Button variant="primary" size="sm" onClick={this.createBucket}>
              <FontAwesomeIcon icon={faPlus} />
              {' '}
              New
            </Button>
          </div>
          <div className="tableBorder">
            <Table responsive size="sm" hover className="admin-table">
              <thead>
                <tr>
                  <th width="30">Enabled</th>
                  <th>Bucket</th>
                  <th>Replication</th>
                  <th> </th>
                  <th> </th>
                  <th> </th>
                </tr>
              </thead>
              <tbody>
                {
                buckets.map((item) => (
                  <BucketListItem
                    item={item}
                    parent={this}
                    key={item.key}
                    onDelete={this.deleteBucket}
                    onShowReplicationDlg={this.onShowReplicationDlg}
                    onRepair={this.repairBucket}
                    onToggleEnable={this.toggleEnable}
                  />
                ))
              }
              </tbody>
            </Table>
          </div>
        </div>
      </div>
    );
  }
}
