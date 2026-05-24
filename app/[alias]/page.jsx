"use client";

import { useParams } from 'next/navigation';
import HomePage from '../page';

export default function AliasPage() {
  const params = useParams();
  const alias = decodeURIComponent(params.alias || '');

  return <HomePage initialAlias={alias} />;
}
