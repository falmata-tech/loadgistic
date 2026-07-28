"use client";

import React from 'react';
import { ETHIOPIA_PLACES } from '@/lib/ethiopia-places.js';

type Props=React.InputHTMLAttributes<HTMLInputElement>&{id:string};

export function EthiopiaPlaceInput({id,...props}:Props) {
  const listId=`${id}-ethiopia-places`;
  return <><input {...props} id={id} list={listId}/><datalist id={listId}>{ETHIOPIA_PLACES.map(place=><option value={place.name} key={place.name}/>)}</datalist></>;
}
