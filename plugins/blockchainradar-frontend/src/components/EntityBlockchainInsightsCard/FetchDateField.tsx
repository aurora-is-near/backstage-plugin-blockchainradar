import React from 'react';
import { makeStyles } from '@material-ui/core';

import moment from 'moment';

/**
 * Props for {@link FetchDateField}.
 *
 * @public
 */
export interface FetchDateFieldProps {
  date: number;
}

const useStyles = makeStyles(theme => ({
  date: {
    color: theme.palette.text.secondary,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
}));

/** @public */
export function FetchDateField(props: FetchDateFieldProps) {
  const { date } = props;
  const classes = useStyles();
  return (
    <span className={classes.date}>
      <span>Fetched on&nbsp;</span>
      <time>{new Date(date).toDateString()}</time>
      <span> ({moment(date).fromNow()})</span>
    </span>
  );
}
