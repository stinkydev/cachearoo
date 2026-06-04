import React from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
} from 'react-bootstrap';
import PropTypes from 'prop-types';
import ReplicationEditor from './replication-editor';

export default class BucketListItem extends React.PureComponent {
  constructor() {
    super();
    this.bucket = '_bucket_config';
    this.state = {};
  }

  deleteBucketClicked = () => {
    const { onDelete, item } = this.props;
    onDelete(item);
  }

  repairBucketClicked = () => {
    const { onRepair, item } = this.props;
    onRepair(item);
  }

  showReplicationDialog = () => {
    const { onShowReplicationDlg, item } = this.props;
    onShowReplicationDlg(item);
  }

  handleEnableChanged = () => {
    const { onToggleEnable, item } = this.props;
    onToggleEnable(item);
  }

  render() {
    const { item } = this.props;

    const open = item.status.isOpen;

    let bucketName = <td><Link to={`/buckets/${encodeURIComponent(item.key)}`}>{item.key}</Link></td>;
    if (!open) {
      bucketName = <td>{item.key}</td>;
    }

    const replicationEnabled = !!item.config.replication;

    return (
      <tr key={item.key}>
        <td><input type="checkbox" checked={!item.config.disabled} onChange={this.handleEnableChanged} /></td>
        {bucketName}
        <td>
          <Button variant="outline-secondary" className="smaller-btn" size="sm" onClick={this.showReplicationDialog} disabled={!open}>Edit</Button>
        </td>
        <td>
          <ReplicationEditor
            enabled={replicationEnabled}
            connected={!!item.status.replicationConnected}
            uri={item.config.replicationURI}
            apiKey={item.config.apiKey}
            status={item.status.replicationStatus || ''}
          />
        </td>
        <td><Button variant="outline-danger" className="smaller-btn" size="sm" disabled={!open} onClick={this.deleteBucketClicked}>Delete</Button></td>
        <td>{!open ? <Button variant="outline-warning" className="smaller-btn" size="sm" onClick={this.repairBucketClicked}>Repair</Button> : null }</td>
      </tr>
    );
  }
}

BucketListItem.propTypes = {
  onDelete: PropTypes.func.isRequired,
  onRepair: PropTypes.func.isRequired,
  onShowReplicationDlg: PropTypes.func.isRequired,
  onToggleEnable: PropTypes.func.isRequired,
  item: PropTypes.shape({
    key: PropTypes.string.isRequired,
    status: PropTypes.shape({
      replicationConnected: PropTypes.bool,
      replicationStatus: PropTypes.string,
      isOpen: PropTypes.bool,
    }),
    config: PropTypes.shape({
      disabled: PropTypes.bool,
      replication: PropTypes.any,
      replicationURI: PropTypes.string,
      apiKey: PropTypes.string,
    }).isRequired,
  }),
};

BucketListItem.defaultProps = {
  item: {
    status: {
      replicationConnected: false,
      replicationStatus: '',
      isOpen: false,
    },
  },
};
