import React from 'react';
import {
  makeStyles,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
} from '@material-ui/core';

const useStyles = makeStyles({
  description: {
    wordBreak: 'break-word',
  },
  table: {},
});

/**
 * Props for {@link DiscoveredStateTable}.
 *
 * @public
 */
export interface DiscoveredStateTableProps {
  state: string[];
  renderCallback: (key: string) => JSX.Element;
}

/** @public */
export function DiscoveredStateTable(props: DiscoveredStateTableProps) {
  const { state, renderCallback } = props;

  const classes = useStyles();

  return (
    <TableContainer>
      <Table className={classes.table} size="small">
        <TableBody>
          {state.map(stateKey => {
            return (
              <TableRow title={stateKey}>
                <TableCell>{renderCallback(stateKey)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
